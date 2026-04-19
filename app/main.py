# app/main.py
import asyncio
import os
import sys
import json
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from bson import ObjectId

# Windows event loop fix
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.db import connect_db, close_db, get_database
from app.workers.campaign_runner import run_campaign, import_leads_from_csv
from app.workers.followup_worker import followup_worker, run_followups_once
from app.services.campaign_config import (
    get_all_configs, get_config_by_id, get_active_config,
    create_config, update_config, delete_config, activate_config
)
import app.workers.campaign_runner as campaign_runner_module
from fastapi.responses import Response
import pandas as pd

app = FastAPI(title="mySalesTeam API", version="2.0")

# ========================
# CORS — Allow React frontend
# ========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000",
        "https://mysalesteam1.onrender.com"
    ],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================
# WEBSOCKET MANAGER
# ========================
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        message = json.dumps(data, default=str)
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.active_connections.remove(d)


ws_manager = ConnectionManager()
# Inject ws_manager into campaign_runner so it can broadcast events
campaign_runner_module.ws_manager = ws_manager


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if doc is None:
        return None
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        elif isinstance(v, dict):
            result[k] = serialize_doc(v)
        elif isinstance(v, list):
            result[k] = [serialize_doc(i) if isinstance(i, dict) else str(i) if isinstance(i, ObjectId) else i for i in v]
        else:
            result[k] = v
    return result


# ========================
# LIFECYCLE
# ========================
@app.on_event("startup")
async def startup():
    await connect_db()
    print("✅ MongoDB connected")


@app.on_event("shutdown")
async def shutdown():
    await close_db()


# ========================
# WEBSOCKET
# ========================
@app.websocket("/ws/live-status")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ========================
# LEADS
# ========================
@app.post("/upload-leads")
async def upload_leads(file: UploadFile = File(...), full_sync: bool = False):
    """Upload a CSV file of leads and import into MongoDB."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")
    content = await file.read()
    results = await import_leads_from_csv(content, full_sync=full_sync)
    msg = f"Inserted: {results['inserted']}, Updated: {results['updated']}"
    if full_sync:
        msg += f", Deleted: {results['deleted']}"
    return {"status": "success", "imported": results['inserted'], "updated": results['updated'], "message": msg}


@app.post("/import-from-file")
async def import_from_disk_file(full_sync: bool = False):
    """
    Import leads from the server-side data/leads.csv file into MongoDB.
    Use this if you placed the CSV manually in the data/ folder.
    """
    import os
    csv_path = os.path.join(os.getcwd(), "data", "leads.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(
            status_code=404,
            detail=f"data/leads.csv not found at {csv_path}. Upload a file via the Upload page instead."
        )
    with open(csv_path, "rb") as f:
        content = f.read()
    results = await import_leads_from_csv(content, full_sync=full_sync)
    msg = f"Inserted: {results['inserted']}, Updated: {results['updated']}"
    if full_sync:
        msg += f", Deleted: {results['deleted']}"
    return {
        "status": "success",
        "imported": results['inserted'],
        "updated": results['updated'],
        "message": msg,
        "file_path": csv_path
    }


class LeadCreate(BaseModel):
    client_name: str
    email: str
    website: str = ""
    client_type: str = "generic"

class LeadUpdate(BaseModel):
    client_name: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    client_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None

class FollowupUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    followup_day: Optional[int] = None

class CampaignConfigCreate(BaseModel):
    name: str = "Default Campaign"
    campaign_type: str = "generic"
    company_name: str = ""
    company_desc: str = ""
    company_website: str = ""
    demo_link: str = ""
    pitch_message: str = ""
    sender_name: str = ""
    attachments: List[str] = []
    is_active: bool = False

class CampaignConfigUpdate(BaseModel):
    name: Optional[str] = None
    campaign_type: Optional[str] = None
    company_name: Optional[str] = None
    company_desc: Optional[str] = None
    company_website: Optional[str] = None
    demo_link: Optional[str] = None
    pitch_message: Optional[str] = None
    sender_name: Optional[str] = None
    attachments: Optional[List[str]] = None
    is_active: Optional[bool] = None

# Attachment constants
ATTACHMENTS_DIR = os.path.join(os.getcwd(), "data", "attachments")
MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024  # 5MB
MAX_ATTACHMENTS = 3
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".docx", ".doc", ".xlsx", ".pptx"}

@app.post("/leads")
async def create_lead(lead: LeadCreate):
    """Manually add a single lead to MongoDB."""
    db = get_database()
    existing = await db["leads"].find_one({"email": lead.email})
    if existing:
        raise HTTPException(status_code=400, detail="Lead with this email already exists.")
    
    from app.models import lead_model
    new_lead = lead_model(lead.dict())
    
    result = await db["leads"].insert_one(new_lead)
    new_lead["_id"] = result.inserted_id
    return serialize_doc(new_lead)

@app.get("/leads")
async def get_leads(status: Optional[str] = None, priority: Optional[str] = None):
    """Get all leads with optional filters."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority

    leads = await db["leads"].find(query).sort("created_at", -1).to_list(length=1000)
    return [serialize_doc(lead) for lead in leads]


@app.get("/export-leads")
async def export_leads():
    """Export all leads to CSV."""
    db = get_database()
    leads = await db["leads"].find({}).to_list(length=10000)
    if not leads:
        return Response(content="No leads found", media_type="text/plain")
    
    df = pd.DataFrame(leads)
    df["_id"] = df["_id"].astype(str)
    
    # Remove large diagnostic fields to keep CSV clean
    if "analysis" in df.columns:
        df = df.drop(columns=["analysis"])
        
    csv_data = df.to_csv(index=False)
    return Response(
        content=csv_data, 
        media_type="text/csv", 
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"}
    )


@app.put("/leads/{lead_id}")
async def update_lead(lead_id: str, update_data: LeadUpdate):
    """Update a specific lead."""
    db = get_database()
    data = {k: v for k, v in update_data.dict().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No valid fields provided for update.")
    
    data["updated_at"] = datetime.utcnow()
    
    result = await db["leads"].update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    return {"status": "success", "message": f"Lead {lead_id} updated successfully."}


@app.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    """Get a single lead by ID."""
    db = get_database()
    lead = await db["leads"].find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return serialize_doc(lead)


@app.post("/mark-closed/{lead_id}")
async def mark_lead_closed(lead_id: str):
    """Mark a deal as closed — stops all future follow-ups."""
    db = get_database()
    now = datetime.utcnow()

    result = await db["leads"].update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": {"is_closed": True, "status": "closed", "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Also mark all pending followups for this lead as closed
    await db["followups"].update_many(
        {"lead_id": lead_id, "sent": False},
        {"$set": {"is_closed": True}}
    )

    return {"status": "success", "message": f"Lead {lead_id} marked as closed."}


@app.post("/mark-open/{lead_id}")
async def mark_lead_open(lead_id: str):
    """Reopen a closed deal."""
    db = get_database()
    result = await db["leads"].update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": {"is_closed": False, "status": "contacted", "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"status": "success", "message": "Lead reopened."}


@app.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead and all its follow-ups/logs."""
    db = get_database()
    await db["leads"].delete_one({"_id": ObjectId(lead_id)})
    await db["followups"].delete_many({"lead_id": lead_id})
    await db["email_logs"].delete_many({"lead_id": lead_id})
    return {"status": "success", "message": "Lead deleted."}


# ========================
# CAMPAIGN
# ========================
@app.post("/start-campaign")
async def start_campaign(lead_id: Optional[str] = None):
    """
    Start the outreach campaign.
    If lead_id is provided, runs for that specific lead only.
    Otherwise processes all pending leads.
    """
    asyncio.create_task(run_campaign(lead_id=lead_id))
    msg = f"Campaign started for lead {lead_id}" if lead_id else "Campaign started for all pending leads"
    return {"status": "started", "message": msg}


# ========================
# EMAIL LOGS
# ========================
@app.get("/email-logs")
async def get_email_logs(
    client_name: Optional[str] = None,
    email_type: Optional[str] = None,
    lead_id: Optional[str] = None,
    limit: int = 100
):
    """Get all email logs. Supports filtering by client, type, or lead."""
    db = get_database()
    query = {}
    if client_name:
        query["client_name"] = {"$regex": client_name, "$options": "i"}
    if email_type:
        query["email_type"] = email_type
    if lead_id:
        query["lead_id"] = lead_id

    logs = await db["email_logs"].find(query).sort("sent_at", -1).limit(limit).to_list(length=limit)
    return [serialize_doc(log) for log in logs]


# ========================
# FOLLOW-UPS
# ========================
@app.get("/followups")
async def get_followups(
    sent: Optional[bool] = None,
    is_closed: Optional[bool] = None,
    client_name: Optional[str] = None
):
    """Get all follow-ups with optional filters."""
    db = get_database()
    query = {}
    if sent is not None:
        query["sent"] = sent
    if is_closed is not None:
        query["is_closed"] = is_closed
    if client_name:
        query["client_name"] = {"$regex": client_name, "$options": "i"}

    followups = await db["followups"].find(query).sort("scheduled_at", 1).to_list(length=1000)
    return [serialize_doc(f) for f in followups]

@app.delete("/followups/{followup_id}")
async def delete_followup(followup_id: str):
    """Delete/cancel a scheduled follow-up."""
    db = get_database()
    result = await db["followups"].delete_one({"_id": ObjectId(followup_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return {"status": "success", "message": "Follow-up successfully canceled."}


@app.post("/start-followups")
async def start_followups():
    """Manually start a single cycle of the follow-ups."""
    asyncio.create_task(run_followups_once())
    return {"status": "started", "message": "Follow-ups manual run triggered."}


@app.put("/followups/{followup_id}")
async def update_followup(followup_id: str, update_data: FollowupUpdate):
    """Update a scheduled follow-up (e.g. reschedule 'scheduled_at' or change day block)."""
    db = get_database()
    
    data = {}
    for k, v in update_data.dict().items():
        if v is not None:
            if isinstance(v, datetime) and v.tzinfo is not None:
                v = v.replace(tzinfo=None)
            data[k] = v

    if not data:
        raise HTTPException(status_code=400, detail="No valid fields provided for update.")
    
    result = await db["followups"].update_one(
        {"_id": ObjectId(followup_id)},
        {"$set": data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
        
    return {"status": "success", "message": "Follow-up schedule updated successfully."}


# ========================
# CAMPAIGN CONFIGS
# ========================
@app.get("/campaign-configs")
async def list_campaign_configs():
    """List all saved campaign configurations."""
    configs = await get_all_configs()
    return [serialize_doc(c) for c in configs]


@app.get("/campaign-configs/active")
async def get_active_campaign_config():
    """Get the currently active campaign config."""
    config = await get_active_config()
    if not config:
        return None
    return serialize_doc(config)


@app.get("/campaign-configs/{config_id}")
async def get_campaign_config(config_id: str):
    """Get a single campaign config by ID."""
    config = await get_config_by_id(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Campaign config not found")
    return serialize_doc(config)


@app.post("/campaign-configs")
async def create_campaign_config(data: CampaignConfigCreate):
    """Create a new campaign configuration."""
    doc = await create_config(data.dict())
    return serialize_doc(doc)


@app.put("/campaign-configs/{config_id}")
async def update_campaign_config(config_id: str, data: CampaignConfigUpdate):
    """Update a campaign configuration."""
    payload = {k: v for k, v in data.dict().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No valid fields provided.")
    success = await update_config(config_id, payload)
    if not success:
        raise HTTPException(status_code=404, detail="Campaign config not found")
    return {"status": "success", "message": "Campaign config updated."}


@app.delete("/campaign-configs/{config_id}")
async def delete_campaign_config(config_id: str):
    """Delete a campaign configuration."""
    success = await delete_config(config_id)
    if not success:
        raise HTTPException(status_code=404, detail="Campaign config not found")
    return {"status": "success", "message": "Campaign config deleted."}


@app.post("/campaign-configs/{config_id}/activate")
async def activate_campaign_config(config_id: str):
    """Set a campaign config as the active one."""
    success = await activate_config(config_id)
    if not success:
        raise HTTPException(status_code=404, detail="Campaign config not found")
    return {"status": "success", "message": "Campaign config activated."}


# ========================
# ATTACHMENTS
# ========================
@app.post("/upload-attachment")
async def upload_attachment(file: UploadFile = File(...)):
    """Upload a file attachment for campaigns (max 5MB, PDF/images/docs)."""
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read content and check size
    content = await file.read()
    if len(content) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size is {MAX_ATTACHMENT_SIZE // (1024*1024)}MB."
        )

    # Generate unique filename
    unique_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    filepath = os.path.join(ATTACHMENTS_DIR, unique_name)

    # Ensure directory exists
    os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "status": "success",
        "filename": unique_name,
        "original_name": file.filename,
        "size": len(content),
        "message": f"Attachment '{file.filename}' uploaded successfully."
    }


@app.delete("/delete-attachment/{filename}")
async def delete_attachment(filename: str):
    """Delete an uploaded attachment file."""
    filepath = os.path.join(ATTACHMENTS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Attachment not found")
    os.remove(filepath)
    return {"status": "success", "message": f"Attachment '{filename}' deleted."}


@app.get("/attachments")
async def list_attachments():
    """List all uploaded attachment files."""
    os.makedirs(ATTACHMENTS_DIR, exist_ok=True)
    files = []
    for f in os.listdir(ATTACHMENTS_DIR):
        filepath = os.path.join(ATTACHMENTS_DIR, f)
        if os.path.isfile(filepath):
            files.append({
                "filename": f,
                "size": os.path.getsize(filepath),
                "original_name": "_".join(f.split("_")[1:]) if "_" in f else f,
            })
    return files


# ========================
# STATS / DASHBOARD
# ========================
@app.get("/stats")
async def get_stats():
    """Dashboard stats."""
    db = get_database()

    total_leads = await db["leads"].count_documents({})
    pending = await db["leads"].count_documents({"status": "pending"})
    contacted = await db["leads"].count_documents({"status": "contacted"})
    closed = await db["leads"].count_documents({"status": "closed"})
    failed = await db["leads"].count_documents({"status": "failed"})
    exhausted = await db["leads"].count_documents({"status": "exhausted"})

    total_emails = await db["email_logs"].count_documents({})
    emails_sent = await db["email_logs"].count_documents({"status": "sent"})
    emails_failed = await db["email_logs"].count_documents({"status": "failed"})

    followups_pending = await db["followups"].count_documents({"sent": False, "is_closed": {"$ne": True}})
    followups_sent = await db["followups"].count_documents({"sent": True})

    # Recent activity (last 10 email logs)
    recent = await db["email_logs"].find({}).sort("sent_at", -1).limit(10).to_list(length=10)

    return {
        "leads": {
            "total": total_leads,
            "pending": pending,
            "contacted": contacted,
            "closed": closed,
            "failed": failed,
            "exhausted": exhausted,
        },
        "emails": {
            "total": total_emails,
            "sent": emails_sent,
            "failed": emails_failed,
        },
        "followups": {
            "pending": followups_pending,
            "sent": followups_sent,
        },
        "recent_activity": [serialize_doc(r) for r in recent]
    }


@app.get("/fix-db-emails")
async def fix_db_emails():
    """Temporary endpoint to fix and clean invalid emails in DB."""
    db = get_database()
    leads_col = db["leads"]
    followups_col = db["followups"]
    
    leads = await leads_col.find({}).to_list(length=None)
    fixed_logs = []
    
    for lead in leads:
        raw_email = lead.get("email", "")
        
        if not raw_email or str(raw_email).lower() in ('nan', 'none'):
            await leads_col.delete_one({"_id": lead["_id"]})
            await followups_col.delete_many({"lead_id": str(lead["_id"])})
            fixed_logs.append(f"Deleted (empty/nan): {raw_email}")
            continue

        email_str = str(raw_email).replace("%20", "").strip()
        
        # Grab the first valid-looking email from the messy string
        candidates = email_str.replace(";", ",").replace(" ", ",").split(",")
        valid_email = None
        for cand in candidates:
            cand = cand.strip()
            if cand and "@" in cand and "." in cand:
                valid_email = cand
                break
                
        if valid_email and valid_email != raw_email:
            await leads_col.update_one({"_id": lead["_id"]}, {"$set": {"email": valid_email}})
            await followups_col.update_many({"lead_id": str(lead["_id"])}, {"$set": {"email": valid_email}})
            fixed_logs.append(f"Fixed: {raw_email} -> {valid_email}")
        elif not valid_email:
            await leads_col.delete_one({"_id": lead["_id"]})
            await followups_col.delete_many({"lead_id": str(lead["_id"])})
            fixed_logs.append(f"Deleted (no valid email): {raw_email}")
            
    return {"status": "success", "fixed_count": len(fixed_logs), "logs": fixed_logs}

@app.get("/")
async def root():
    return {"message": "mySalesTeam API v2.0 — use /docs for Swagger UI"}