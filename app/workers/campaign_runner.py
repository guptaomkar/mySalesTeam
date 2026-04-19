# app/workers/campaign_runner.py
import asyncio
import pandas as pd
from datetime import datetime, timedelta
from bson import ObjectId

from app.services.scraper import get_website_content
from app.services.analyzer import analyze_html
from app.services.email_generator import generate_email
from app.services.email_sender import send_email
from app.services.scoring import score_lead
from app.services.campaign_config import get_active_config
from app.models import lead_model, followup_model
from app.db import get_database
from app.utils.logger import log_info, log_error, log_to_db, save_email_log
from app.config import DAILY_FOLLOWUP_INTERVAL_HOURS, MAX_FOLLOWUP_DAYS

# WebSocket manager (injected from main.py)
ws_manager = None


async def broadcast(event: dict):
    """Send a real-time event to all connected WebSocket clients."""
    if ws_manager:
        await ws_manager.broadcast(event)


async def process_lead(lead: dict, campaign_config: dict = None):
    """Process a single lead: scrape → analyze → generate email → send → schedule follow-ups."""
    db = get_database()
    leads_col = db["leads"]
    followups_col = db["followups"]

    lead_id = lead["_id"]
    client_name = lead["client_name"]
    website = lead["website"]
    email_addr = lead["email"]

    try:
        # ---- Update status: in_progress ----
        await leads_col.update_one(
            {"_id": lead_id},
            {"$set": {"status": "in_progress", "updated_at": datetime.utcnow()}}
        )
        await broadcast({"event": "started", "client": client_name, "email": email_addr})
        log_info(f"🚀 START: {client_name}")

        # ---- SCRAPE ----
        html = await get_website_content(website)
        await broadcast({"event": "scraped", "client": client_name})
        log_info(f"🌐 Scraped: {client_name}")

        # ---- ANALYZE ----
        analysis = analyze_html(html)
        client_type = analysis.get("client_type", "generic")
        priority = score_lead(analysis)
        await broadcast({"event": "analyzed", "client": client_name, "type": client_type, "priority": priority})
        log_info(f"🧠 Analyzed: {client_name} | Type: {client_type} | Priority: {priority}")

        # Update analysis in DB
        await leads_col.update_one(
            {"_id": lead_id},
            {"$set": {
                "analysis": analysis,
                "client_type": client_type,
                "priority": priority,
                "updated_at": datetime.utcnow()
            }}
        )

        # ---- GENERATE EMAIL ----
        subject, body = await generate_email(client_name, website, analysis, client_type, campaign_config=campaign_config)
        await broadcast({"event": "email_generated", "client": client_name})
        log_info(f"✍️ Email generated: {client_name}")

        # ---- SEND EMAIL ----
        # Get attachments and sender name from campaign config if available
        attachments = None
        sender_name = None
        if campaign_config:
            if campaign_config.get("attachments"):
                attachments = campaign_config["attachments"]
            if campaign_config.get("sender_name"):
                sender_name = campaign_config["sender_name"]

        await send_email(email_addr, subject, body, attachments=attachments, sender_name_override=sender_name)
        await broadcast({"event": "email_sent", "client": client_name, "subject": subject})
        log_info(f"📧 Email sent: {client_name} → {email_addr}")

        # ---- SAVE EMAIL LOG ----
        await save_email_log({
            "lead_id": str(lead_id),
            "client_name": client_name,
            "email": email_addr,
            "email_type": "initial",
            "subject": subject,
            "body": body,
            "status": "sent"
        })

        # ---- UPDATE LEAD STATUS ----
        await leads_col.update_one(
            {"_id": lead_id},
            {"$set": {
                "status": "contacted",
                "emails_sent": 1,
                "updated_at": datetime.utcnow()
            }}
        )

        # ---- LOG TO CAMPAIGN LOGS ----
        await log_to_db({
            "client_name": client_name,
            "email": email_addr,
            "status": "success",
            "message": f"Initial email sent: {subject}"
        })

        # ---- SCHEDULE DAILY FOLLOW-UPS ----
        # Day 1 follow-up scheduled DAILY_FOLLOWUP_INTERVAL_HOURS from now
        scheduled_at = datetime.utcnow() + timedelta(hours=DAILY_FOLLOWUP_INTERVAL_HOURS)
        followup_doc = followup_model({
            "lead_id": str(lead_id),
            "client_name": client_name,
            "email": email_addr,
            "website": website,
            "client_type": client_type,
            "followup_day": 1,
            "scheduled_at": scheduled_at
        })
        await followups_col.insert_one(followup_doc)
        log_info(f"📅 Follow-up Day 1 scheduled for {client_name} at {scheduled_at}")

        await broadcast({"event": "done", "client": client_name})

    except Exception as e:
        log_error(f"❌ Error processing {client_name}: {str(e)}")

        # Save failed email log
        await save_email_log({
            "lead_id": str(lead_id),
            "client_name": client_name,
            "email": email_addr,
            "email_type": "initial",
            "subject": "",
            "body": "",
            "status": "failed",
            "error": str(e)
        })

        await leads_col.update_one(
            {"_id": lead_id},
            {"$set": {"status": "failed", "updated_at": datetime.utcnow()}}
        )

        await log_to_db({
            "client_name": client_name,
            "email": email_addr,
            "status": "error",
            "message": str(e)
        })

        await broadcast({"event": "error", "client": client_name, "error": str(e)})


async def run_campaign(lead_id: str = None):
    """
    Run the outreach campaign.
    If lead_id is provided, runs for a single lead.
    Otherwise, runs for all pending leads from MongoDB.
    """
    db = get_database()
    leads_col = db["leads"]

    log_info("🔥 Campaign started")

    # Fetch active campaign config (once, at the start)
    campaign_config = await get_active_config()
    if campaign_config:
        log_info(f"📋 Using campaign config: {campaign_config.get('name', 'Unnamed')}")
    else:
        log_info("📋 No active campaign config — using .env defaults")

    if lead_id:
        # Single lead run
        lead = await leads_col.find_one({"_id": ObjectId(lead_id)})
        if lead:
            await process_lead(lead, campaign_config=campaign_config)
        else:
            log_error(f"Lead not found: {lead_id}")
    else:
        # All pending leads
        leads = await leads_col.find({"status": "pending"}).to_list(length=500)
        log_info(f"📂 Found {len(leads)} pending leads")

        # Process one by one (sequential to avoid email rate issues)
        for lead in leads:
            await process_lead(lead, campaign_config=campaign_config)
            await asyncio.sleep(15)  # Delay between sends to avoid Gmail rate limits

    log_info("✅ Campaign finished")


async def import_leads_from_csv(file_content: bytes, full_sync: bool = False) -> dict:
    """
    Parse CSV bytes and insert/update leads into MongoDB.
    Returns counts of inserted, updated, deleted.
    Matches by _id if present, else by email.
    If full_sync is True, deletes any leads not in the CSV.
    """
    import io
    db = get_database()
    leads_col = db["leads"]

    df = pd.read_csv(io.BytesIO(file_content))
    # Clean column names (strip whitespace and BOM)
    df.columns = [c.strip().lstrip('\ufeff').replace('\ufeff', '') for c in df.columns]
    # Drop rows where all values are NaN
    df = df.dropna(how="all")

    count_inserted = 0
    count_updated = 0
    count_deleted = 0
    processed_ids = []

    for _, row in df.iterrows():
        email = str(row.get("Email", row.get("email", ""))).strip()
        if not email or email.lower() in ("nan", "none", ""):
            continue
        if "@" not in email:
            continue

        lead_id_str = str(row.get("_id", row.get("id", ""))).strip()
        client_name = str(row.get("Client", row.get("Name", row.get("client_name", "Unknown")))).strip()
        website = str(row.get("Website", row.get("website", ""))).strip()
        client_type = str(row.get("ClientType", row.get("client_type", "generic"))).strip().lower()

        update_data = {
            "client_name": client_name,
            "website": website,
            "email": email,
            "client_type": client_type,
            "updated_at": datetime.utcnow()
        }
        
        if "status" in df.columns and pd.notna(row.get("status")):
            update_data["status"] = str(row.get("status")).strip()
        if "priority" in df.columns and pd.notna(row.get("priority")):
            update_data["priority"] = str(row.get("priority")).strip()

        # Match by ID first
        if lead_id_str and lead_id_str.lower() not in ("nan", "none", ""):
            try:
                existing = await leads_col.find_one({"_id": ObjectId(lead_id_str)})
                if existing:
                    await leads_col.update_one({"_id": ObjectId(lead_id_str)}, {"$set": update_data})
                    processed_ids.append(ObjectId(lead_id_str))
                    count_updated += 1
                    log_info(f"🔄 Updated by _id: {client_name} ({email})")
                    continue
            except Exception:
                pass
        
        # Match by Email second
        existing = await leads_col.find_one({"email": email})
        if existing:
            await leads_col.update_one({"_id": existing["_id"]}, {"$set": update_data})
            processed_ids.append(existing["_id"])
            count_updated += 1
            log_info(f"🔄 Updated by email: {client_name} ({email})")
            continue

        # Otherwise Insert
        lead = lead_model({
            "client_name": client_name,
            "website": website,
            "email": email,
            "client_type": client_type
        })
        res = await leads_col.insert_one(lead)
        processed_ids.append(res.inserted_id)
        count_inserted += 1
        log_info(f"✅ Imported: {client_name} ({email})")

    # Full Sync -> delete anything not in processed_ids
    if full_sync:
        res = await leads_col.delete_many({"_id": {"$nin": processed_ids}})
        count_deleted = res.deleted_count
        if count_deleted > 0:
            log_info(f"🗑️ Full Sync requested: Deleted {count_deleted} leads not present in CSV")

    return {
        "inserted": count_inserted,
        "updated": count_updated,
        "deleted": count_deleted
    }