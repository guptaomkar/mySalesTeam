# services/followup.py
from datetime import datetime, timedelta

def schedule_followups(lead):
    return [
        {"time": datetime.now() + timedelta(days=2), "type": "followup_1"},
        {"time": datetime.now() + timedelta(days=5), "type": "followup_2"},
    ]