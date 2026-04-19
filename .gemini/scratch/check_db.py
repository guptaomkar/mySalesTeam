import asyncio
import re
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "outreach_ai"

def is_valid_email(email):
    # Basic email validation regex
    if not isinstance(email, str):
        return False
    email = email.strip()
    if not email:
        return False
    # Check for basic structure: something @ something . something
    pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return re.match(pattern, email) is not None

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    leads = await db["leads"].find({}).to_list(length=None)
    
    print(f"Total leads in database: {len(leads)}")
    
    invalid_leads = []
    for lead in leads:
        email = lead.get("email", "")
        if not is_valid_email(email):
            invalid_leads.append(lead)
            
    print(f"Found {len(invalid_leads)} invalid leads:")
    for lead in invalid_leads[:20]: # print first 20
        print(f"ID: {lead.get('_id')} | Name: {lead.get('client_name')} | Email: '{lead.get('email')}'")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
