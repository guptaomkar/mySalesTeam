# app/workers/followup_worker.py
import asyncio
from datetime import datetime, timedelta

from app.db import connect_db, close_db, get_database
from app.services.email_sender import send_email
from app.services.followup_generator import generate_daily_followup
from app.services.campaign_config import get_active_config
from app.utils.logger import log_info, log_error, log_to_db, save_email_log
from app.config import DAILY_FOLLOWUP_INTERVAL_HOURS, MAX_FOLLOWUP_DAYS

CHECK_INTERVAL = 300  # Check every 5 minutes


# ========================
# PROCESS SINGLE FOLLOW-UP
# ========================
async def process_followup(followup: dict):
    db = get_database()
    followups_col = db["followups"]
    leads_col = db["leads"]

    try:
        client_name = followup["client_name"]
        email_addr = followup["email"]
        website = followup.get("website", "")
        client_type = followup.get("client_type", "generic")
        followup_day = followup.get("followup_day", 1)
        lead_id = followup.get("lead_id")

        log_info(f"⏳ Follow-up Day {followup_day} for {client_name}")

        # Check if lead is closed — skip if so
        if lead_id:
            lead = await leads_col.find_one({"_id": lead_id}) if not isinstance(lead_id, str) else None
            if not lead and isinstance(lead_id, str):
                from bson import ObjectId
                try:
                    lead = await leads_col.find_one({"_id": ObjectId(lead_id)})
                except Exception:
                    pass

            if lead and (lead.get("is_closed") or lead.get("status") == "closed"):
                log_info(f"✅ Deal closed for {client_name} — skipping follow-up")
                await followups_col.update_one(
                    {"_id": followup["_id"]},
                    {"$set": {"sent": True, "sent_at": datetime.utcnow(), "skipped_reason": "deal_closed"}}
                )
                return

        # Check global is_closed flag on followup doc
        if followup.get("is_closed"):
            log_info(f"✅ Follow-up is_closed for {client_name} — skipping")
            return

        # Fetch active campaign config for follow-up context
        campaign_config = await get_active_config()

        # Generate follow-up email
        subject, body = await generate_daily_followup(
            client_name=client_name,
            website=website,
            client_type=client_type,
            day_number=followup_day,
            campaign_config=campaign_config
        )

        # Get attachments and sender name from campaign config
        attachments = None
        sender_name = None
        if campaign_config:
            if campaign_config.get("attachments"):
                attachments = campaign_config["attachments"]
            if campaign_config.get("sender_name"):
                sender_name = campaign_config["sender_name"]

        # Send email
        await send_email(email_addr, subject, body, attachments=attachments, sender_name_override=sender_name)
        log_info(f"📧 Follow-up Day {followup_day} sent to {client_name}")

        # Mark this follow-up as sent
        await followups_col.update_one(
            {"_id": followup["_id"]},
            {"$set": {"sent": True, "sent_at": datetime.utcnow()}}
        )

        # Save email log
        await save_email_log({
            "lead_id": lead_id,
            "client_name": client_name,
            "email": email_addr,
            "email_type": f"followup_day_{followup_day}",
            "subject": subject,
            "body": body,
            "status": "sent"
        })

        # Update lead emails_sent count
        if lead_id:
            from bson import ObjectId
            try:
                obj_id = ObjectId(lead_id) if isinstance(lead_id, str) else lead_id
                await leads_col.update_one(
                    {"_id": obj_id},
                    {"$inc": {"emails_sent": 1}, "$set": {"updated_at": datetime.utcnow()}}
                )
            except Exception:
                pass

        # Campaign log
        await log_to_db({
            "client_name": client_name,
            "email": email_addr,
            "status": "success",
            "message": f"Follow-up Day {followup_day} sent: {subject}"
        })

        # ---- SCHEDULE NEXT FOLLOW-UP (if not at max) ----
        next_day = followup_day + 1
        if next_day <= MAX_FOLLOWUP_DAYS:
            next_scheduled = datetime.utcnow() + timedelta(hours=DAILY_FOLLOWUP_INTERVAL_HOURS)
            from app.models import followup_model
            next_followup = followup_model({
                "lead_id": lead_id,
                "client_name": client_name,
                "email": email_addr,
                "website": website,
                "client_type": client_type,
                "followup_day": next_day,
                "scheduled_at": next_scheduled
            })
            await followups_col.insert_one(next_followup)
            log_info(f"📅 Follow-up Day {next_day} scheduled for {client_name} at {next_scheduled}")
        else:
            log_info(f"🏁 Max follow-up days reached for {client_name} ({MAX_FOLLOWUP_DAYS} days)")
            # Optionally mark lead as exhausted
            if lead_id:
                from bson import ObjectId
                try:
                    obj_id = ObjectId(lead_id) if isinstance(lead_id, str) else lead_id
                    await leads_col.update_one(
                        {"_id": obj_id},
                        {"$set": {"status": "exhausted", "updated_at": datetime.utcnow()}}
                    )
                except Exception:
                    pass

    except Exception as e:
        log_error(f"❌ Follow-up error for {followup.get('client_name')}: {str(e)}")

        await save_email_log({
            "lead_id": followup.get("lead_id"),
            "client_name": followup.get("client_name"),
            "email": followup.get("email"),
            "email_type": f"followup_day_{followup.get('followup_day', 1)}",
            "subject": "",
            "body": "",
            "status": "failed",
            "error": str(e)
        })

        await log_to_db({
            "client_name": followup.get("client_name"),
            "email": followup.get("email"),
            "status": "error",
            "message": str(e)
        })


# ========================
# MANUAL RUN ONE CYCLE
# ========================
async def run_followups_once():
    db = get_database()
    followups_col = db["followups"]

    log_info("🔄 Follow-up manual run started...")
    try:
        now = datetime.utcnow()

        # Find pending follow-ups that are due
        pending = await followups_col.find({
            "sent": False,
            "is_closed": {"$ne": True},
            "scheduled_at": {"$lte": now}
        }).to_list(length=100)

        if pending:
            log_info(f"🚀 Processing {len(pending)} due follow-ups")
            for followup in pending:
                await process_followup(followup)
                await asyncio.sleep(15)  # Increased delay to avoid Gmail rate limits
        else:
            log_info("😴 No follow-ups due right now")

    except Exception as e:
        log_error(f"Worker manual run error: {str(e)}")


# ========================
# MAIN WORKER LOOP
# ========================
async def followup_worker():
    db = get_database()
    followups_col = db["followups"]

    log_info("🔄 Follow-up worker running...")

    while True:
        try:
            now = datetime.utcnow()

            # Find pending follow-ups that are due
            pending = await followups_col.find({
                "sent": False,
                "is_closed": {"$ne": True},
                "scheduled_at": {"$lte": now}
            }).to_list(length=100)

            if pending:
                log_info(f"🚀 Processing {len(pending)} due follow-ups")
                for followup in pending:
                    await process_followup(followup)
                    await asyncio.sleep(15)  # Increased delay
            else:
                log_info("😴 No follow-ups due right now")

        except Exception as e:
            log_error(f"Worker loop error: {str(e)}")

        await asyncio.sleep(CHECK_INTERVAL)


# ========================
# ENTRY POINT (standalone)
# ========================
async def main():
    await connect_db()
    log_info("🔥 Follow-up worker started")
    try:
        await followup_worker()
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())