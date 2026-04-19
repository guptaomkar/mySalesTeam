# db.py
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URI, MONGO_DB_NAME

class MongoDB:
    client: AsyncIOMotorClient = None

db = MongoDB()

async def connect_db():
    db.client = AsyncIOMotorClient(MONGO_URI)
    print("✅ Connected to MongoDB")

async def close_db():
    db.client.close()
    print("❌ MongoDB connection closed")

def get_database():
    return db.client[MONGO_DB_NAME]