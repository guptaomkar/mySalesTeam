# app/services/campaign_config.py
from datetime import datetime
from bson import ObjectId
from app.db import get_database


# ========================
# CAMPAIGN CONFIG MODEL
# ========================
def campaign_config_model(data: dict) -> dict:
    """Build a campaign config document for MongoDB."""
    return {
        "name": data.get("name", "Default Campaign"),
        "campaign_type": data.get("campaign_type", "generic"),
        "company_name": data.get("company_name", ""),
        "company_desc": data.get("company_desc", ""),
        "company_website": data.get("company_website", ""),
        "demo_link": data.get("demo_link", ""),
        "pitch_message": data.get("pitch_message", ""),
        "sender_name": data.get("sender_name", ""),
        "attachments": data.get("attachments", []),
        "is_active": data.get("is_active", False),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


# ========================
# CRUD HELPERS
# ========================
async def get_all_configs() -> list:
    db = get_database()
    configs = await db["campaign_configs"].find().sort("created_at", -1).to_list(length=50)
    return configs


async def get_config_by_id(config_id: str) -> dict | None:
    db = get_database()
    return await db["campaign_configs"].find_one({"_id": ObjectId(config_id)})


async def get_active_config() -> dict | None:
    """Return the currently active campaign config, or None."""
    db = get_database()
    return await db["campaign_configs"].find_one({"is_active": True})


async def create_config(data: dict) -> dict:
    db = get_database()
    col = db["campaign_configs"]

    # If this is set as active, deactivate all others first
    if data.get("is_active"):
        await col.update_many({}, {"$set": {"is_active": False}})

    doc = campaign_config_model(data)
    result = await col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def update_config(config_id: str, data: dict) -> bool:
    db = get_database()
    col = db["campaign_configs"]

    # If activating this config, deactivate all others first
    if data.get("is_active"):
        await col.update_many(
            {"_id": {"$ne": ObjectId(config_id)}},
            {"$set": {"is_active": False}}
        )

    # Build update payload (only set provided fields)
    update_fields = {}
    allowed = [
        "name", "campaign_type", "company_name", "company_desc",
        "company_website", "demo_link", "pitch_message", "sender_name",
        "attachments", "is_active"
    ]
    for key in allowed:
        if key in data:
            update_fields[key] = data[key]

    if not update_fields:
        return False

    update_fields["updated_at"] = datetime.utcnow()

    result = await col.update_one(
        {"_id": ObjectId(config_id)},
        {"$set": update_fields}
    )
    return result.matched_count > 0


async def delete_config(config_id: str) -> bool:
    db = get_database()
    result = await db["campaign_configs"].delete_one({"_id": ObjectId(config_id)})
    return result.deleted_count > 0


async def activate_config(config_id: str) -> bool:
    """Set one config as active, deactivate all others."""
    db = get_database()
    col = db["campaign_configs"]

    # Deactivate all
    await col.update_many({}, {"$set": {"is_active": False}})

    # Activate this one
    result = await col.update_one(
        {"_id": ObjectId(config_id)},
        {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
    )
    return result.matched_count > 0
