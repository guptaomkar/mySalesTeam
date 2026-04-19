# app/services/followup_generator.py
from openai import AsyncOpenAI
from app.config import OPENAI_API_KEY, PRODUCT_NAME, PRODUCT_DESC, COMPANY_WEBSITE

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# ========================
# DAY-SPECIFIC FOLLOW-UP STRATEGIES
# ========================
FOLLOWUP_STRATEGIES = {
    1: {
        "tone": "casual and friendly re-nudge",
        "angle": "Just checking if they saw the last email. Light and no pressure.",
        "max_words": 60,
        "cta": "Just a quick reply to confirm you got my last message would be great!"
    },
    2: {
        "tone": "helpful, adds value",
        "angle": "Share ONE specific insight about their website or industry trend. Position yourself as an expert.",
        "max_words": 80,
        "cta": "Would love to share the full audit with you — just say the word."
    },
    3: {
        "tone": "social proof, confidence",
        "angle": "Mention that you recently helped a similar business (same industry) get results. Don't name-drop, just reference 'a client in the same space'.",
        "max_words": 90,
        "cta": "Could we jump on a 10-minute call this week?"
    },
    4: {
        "tone": "slight urgency, scarcity",
        "angle": "Mention you're taking on limited new clients this month and wanted to check one more time before moving on.",
        "max_words": 80,
        "cta": "Let me know before Friday and I'll hold a spot for you."
    },
    5: {
        "tone": "empathy + soft push",
        "angle": "Acknowledge they might be busy. Offer to make it super easy — no long calls, just a quick look.",
        "max_words": 70,
        "cta": "Just reply with 'Yes' and I'll send over a custom proposal."
    },
    6: {
        "tone": "bold, direct value offer",
        "angle": "Offer something free: a free homepage design mock-up, a free audit, a free competitor comparison.",
        "max_words": 80,
        "cta": "I'll send you a free mock-up of your website redesign — no strings attached. Want it?"
    },
    7: {
        "tone": "polite final goodbye",
        "angle": "This is the last email. Close the loop gracefully. Leave the door open for the future.",
        "max_words": 60,
        "cta": "Whenever the timing is right, we're here. All the best!"
    },
}

# Client type specific hooks for follow-ups
CLIENT_TYPE_FOLLOWUP_HOOKS = {
    "real_estate": "property leads, listing visibility, and inquiry conversion",
    "restaurant": "online orders, table bookings, and foot traffic",
    "ecommerce": "cart recovery, product conversions, and mobile sales",
    "saas": "free trial signups, demo conversions, and churn reduction",
    "agency": "inbound client leads, portfolio showcase, and proposal wins",
    "portfolio": "job opportunities, freelance projects, and personal brand visibility",
    "generic": "online growth, conversions, and customer engagement",
}


async def generate_daily_followup(
    client_name: str,
    website: str,
    client_type: str,
    day_number: int,
    campaign_config: dict = None
) -> tuple[str, str]:
    """
    Generate a follow-up email for day_number.
    Returns (subject, body).
    If campaign_config is provided, its values override .env defaults.
    """
    # Cap at day 7 strategy
    strategy_day = min(day_number, 7)
    strategy = FOLLOWUP_STRATEGIES.get(strategy_day, FOLLOWUP_STRATEGIES[7])
    hook = CLIENT_TYPE_FOLLOWUP_HOOKS.get(client_type, CLIENT_TYPE_FOLLOWUP_HOOKS["generic"])

    # Use campaign config values if available, otherwise fall back to .env defaults
    product_name = PRODUCT_NAME
    product_desc = PRODUCT_DESC
    company_website = COMPANY_WEBSITE
    demo_link = ""
    pitch_message = ""

    if campaign_config:
        if campaign_config.get("company_name"):
            product_name = campaign_config["company_name"]
        if campaign_config.get("company_desc"):
            product_desc = campaign_config["company_desc"]
        if campaign_config.get("company_website"):
            company_website = campaign_config["company_website"]
        if campaign_config.get("demo_link"):
            demo_link = campaign_config["demo_link"]
        if campaign_config.get("pitch_message"):
            pitch_message = campaign_config["pitch_message"]
        # Override client type if campaign config defines one
        if campaign_config.get("campaign_type") and campaign_config["campaign_type"] != "generic":
            client_type = campaign_config["campaign_type"]
            hook = CLIENT_TYPE_FOLLOWUP_HOOKS.get(client_type, CLIENT_TYPE_FOLLOWUP_HOOKS["generic"])

    # Build optional sections
    demo_section = ""
    if demo_link and day_number in (2, 4, 6):
        demo_section = f"\n- You may reference this demo/preview link naturally if relevant: {demo_link}"

    pitch_section = ""
    if pitch_message and day_number <= 3:
        pitch_section = f"\n- Incorporate this key message if it fits naturally: {pitch_message}"

    prompt = f"""
You are writing Follow-Up Email #{day_number} for {product_name} sales outreach.

{product_name} is {product_desc}
Website: {company_website}

--- CLIENT CONTEXT ---
Client Name: {client_name}
Website: {website}
Industry: {client_type.replace("_", " ").title()}
Key Focus: {hook}

--- TODAY'S STRATEGY (Day {day_number}) ---
Tone: {strategy["tone"]}
Angle: {strategy["angle"]}
Max Words: {strategy["max_words"]}
Call to Action: {strategy["cta"]}

--- STRICT RULES ---
- Start with: Subject: [subject line]
- Then write the email body WITHOUT any formatting
- Sound like a real HUMAN being, not a bot
- Reference the client's name or business naturally
- NO bullet points, NO bold text, NO markdown, NO lists
- Under {strategy["max_words"]} words for the body
- Do NOT repeat the full original pitch
- Do NOT say "I hope this email finds you well"
- DO NOT use ALL CAPS for emphasis
- Keep it conversational and real{demo_section}{pitch_section}

Write Follow-Up Email #{day_number} now:
"""

    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9,
        max_tokens=300
    )

    content = response.choices[0].message.content.strip()

    # Parse subject and body
    lines = content.split("\n")
    subject = ""
    body_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith("subject:"):
            subject = stripped[len("subject:"):].strip()
        elif subject:
            body_lines.append(line)

    if not subject:
        subject = f"Following up — {client_name}"
        body_lines = lines

    # Clean body
    cleaned_body = []
    for line in body_lines:
        line = line.replace("**", "").replace("__", "")
        if line.strip().startswith("- "):
            continue
        cleaned_body.append(line)

    body = "\n".join(cleaned_body).strip()
    return subject, body
