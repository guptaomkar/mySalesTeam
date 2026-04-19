# app/config.py

import os
from dotenv import load_dotenv

load_dotenv()

# ========================
# OPENAI
# ========================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ========================
# EMAIL CONFIG
# ========================
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Sales Team")

GMAIL_HOST = os.getenv("GMAIL_HOST")
GMAIL_PORT = int(os.getenv("GMAIL_PORT", 587))
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASS = os.getenv("GMAIL_PASS")

# ========================
# MONGODB CONFIG
# ========================
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# ========================
# PRODUCT / COMPANY INFO
# ========================
PRODUCT_NAME = os.getenv("PRODUCT_NAME", "Korevyn")
PRODUCT_DESC = os.getenv(
    "PRODUCT_DESC",
    "a modern web design & digital growth agency that builds high-converting websites, "
    "landing pages, and digital experiences for businesses looking to grow online revenues."
)
COMPANY_WEBSITE = os.getenv("COMPANY_WEBSITE", "https://korevyn.com")

# ========================
# SYSTEM SETTINGS
# ========================
MAX_EMAILS_PER_HOUR = int(os.getenv("MAX_EMAILS_PER_HOUR", 40))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DAILY_FOLLOWUP_INTERVAL_HOURS = int(os.getenv("DAILY_FOLLOWUP_INTERVAL_HOURS", 24))
MAX_FOLLOWUP_DAYS = int(os.getenv("MAX_FOLLOWUP_DAYS", 7))