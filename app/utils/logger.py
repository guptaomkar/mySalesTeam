# app/utils/logger.py
import logging
from datetime import datetime
from app.db import get_database

# ========================
# FILE LOGGER SETUP
# ========================
logging.basicConfig(
    filename="app.log",
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)


def log_info(message: str):
    print(f"INFO: {message}")
    logging.info(message)


def log_error(message: str):
    print(f"ERROR: {message}")
    logging.error(message)


# ========================
# DATABASE LOGGER
# ========================
async def log_to_db(data: dict):
    """Log a campaign event to campaign_logs collection."""
    db = get_database()
    collection = db["campaign_logs"]
    await collection.insert_one({
        "client_name": data.get("client_name"),
        "email": data.get("email"),
        "status": data.get("status"),
        "message": data.get("message"),
        "timestamp": datetime.utcnow()
    })


async def save_email_log(data: dict):
    """
    Save a full email record (subject + body) to email_logs collection.
    Called after every email send — initial and follow-ups.
    """
    db = get_database()
    collection = db["email_logs"]
    await collection.insert_one({
        "lead_id": data.get("lead_id"),
        "client_name": data.get("client_name"),
        "email": data.get("email"),
        "email_type": data.get("email_type", "initial"),  # initial / followup_day_N
        "subject": data.get("subject"),
        "body": data.get("body"),
        "status": data.get("status", "sent"),
        "error": data.get("error"),
        "sent_at": datetime.utcnow()
    })