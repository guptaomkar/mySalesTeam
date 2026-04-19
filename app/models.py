# app/models.py
from datetime import datetime


def lead_model(data):
    return {
        "client_name": data.get("client_name"),
        "website": data.get("website"),
        "email": data.get("email"),
        "client_type": data.get("client_type", "generic"),  # real_estate / restaurant / ecommerce / saas / agency / portfolio / generic
        "status": "pending",          # pending / in_progress / contacted / replied / closed / failed
        "priority": None,             # HIGH / MEDIUM / LOW
        "analysis": None,
        "followup_day": 0,            # current follow-up day number
        "is_closed": False,           # True = deal closed, stop all follow-ups
        "emails_sent": 0,             # total emails sent to this lead
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }


def email_log_model(data):
    """Stores every email (initial + follow-ups) with full content."""
    return {
        "lead_id": data.get("lead_id"),          # MongoDB ObjectId of the lead
        "client_name": data.get("client_name"),
        "email": data.get("email"),
        "email_type": data.get("email_type", "initial"),  # initial / followup_day_1 / followup_day_2 / ...
        "subject": data.get("subject"),
        "body": data.get("body"),
        "status": data.get("status", "sent"),     # sent / failed
        "error": data.get("error"),
        "sent_at": datetime.utcnow(),
    }


def campaign_log_model(data):
    return {
        "client_name": data.get("client_name"),
        "email": data.get("email"),
        "status": data.get("status"),   # success / error
        "message": data.get("message"),
        "timestamp": datetime.utcnow()
    }


def followup_model(data):
    return {
        "lead_id": data.get("lead_id"),          # MongoDB ObjectId of the lead
        "client_name": data.get("client_name"),
        "email": data.get("email"),
        "website": data.get("website", ""),
        "client_type": data.get("client_type", "generic"),
        "followup_day": data.get("followup_day", 1),  # which follow-up day (1, 2, 3...)
        "scheduled_at": data.get("scheduled_at"),
        "sent": False,
        "sent_at": None,
        "is_closed": False,
        "created_at": datetime.utcnow()
    }