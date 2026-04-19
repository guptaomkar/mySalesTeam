# app/services/email_generator.py
from openai import AsyncOpenAI
from app.config import OPENAI_API_KEY, PRODUCT_NAME, PRODUCT_DESC, COMPANY_WEBSITE

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# ========================
# CLIENT TYPE ANGLES
# ========================
CLIENT_TYPE_ANGLES = {
    "real_estate": {
        "pain_points": "outdated property listings, slow inquiry response, poor mobile experience, no lead capture forms",
        "value_prop": "stunning property showcase pages, instant inquiry forms, map integrations, WhatsApp call-to-action, 3D virtual tour readiness",
        "cta": "Let's show you a free mock-up of your new listing page.",
    },
    "restaurant": {
        "pain_points": "no online menu, no table booking system, low Google Maps visibility, losing customers to competitors with better digital presence",
        "value_prop": "beautiful digital menus, integrated table reservation, Google review boosters, online ordering page, social-ready food photography sections",
        "cta": "I'd love to show you a 5-minute demo of what your restaurant website could look like.",
    },
    "ecommerce": {
        "pain_points": "high cart abandonment, slow page speed, poor mobile checkout, confusing navigation, low trust signals",
        "value_prop": "conversion-optimized product pages, one-click checkout flow, trust badges, mobile-first design, upsell sections",
        "cta": "Can we do a quick 10-minute call to show you our ecommerce conversion checklist?",
    },
    "saas": {
        "pain_points": "unclear value proposition on homepage, weak onboarding flow, poor feature communication, high bounce rates",
        "value_prop": "crystal-clear hero sections, interactive product demos, pricing table redesign, social proof sections, trial sign-up optimization",
        "cta": "Happy to send over a free landing page audit — just reply and I'll get it to you today.",
    },
    "agency": {
        "pain_points": "portfolio not showcasing work effectively, weak case study pages, no clear lead generation on website, generic service descriptions",
        "value_prop": "premium portfolio designs, compelling case study layouts, client testimonial sections, packaged service pages with strong CTAs",
        "cta": "Want a quick look at how we redesigned another agency's site to 3x their inbound leads?",
    },
    "portfolio": {
        "pain_points": "generic template look, not standing out from competition, weak personal branding, no clear hire-me CTA",
        "value_prop": "bold personal brand design, unique project showcase layouts, animated skill sections, strong contact & hire-me CTAs",
        "cta": "I can share a few portfolio redesign examples — want to take a look?",
    },
    "generic": {
        "pain_points": "outdated design, poor mobile experience, no clear call-to-action, low search visibility",
        "value_prop": "modern conversion-focused design, mobile-optimized layout, fast loading speed, SEO-ready structure",
        "cta": "Would love to show you what we could do for your website in a quick 10-minute walkthrough.",
    },
}


def build_prompt(name: str, url: str, analysis: dict, client_type: str, campaign_config: dict = None) -> str:
    angle = CLIENT_TYPE_ANGLES.get(client_type, CLIENT_TYPE_ANGLES["generic"])
    title = analysis.get("title", "")
    headings = ", ".join(analysis.get("headings", [])[:4])
    summary = analysis.get("summary", "")[:600]
    has_cta = analysis.get("has_cta", False)
    has_form = analysis.get("has_form", False)

    weaknesses = []
    if not has_cta:
        weaknesses.append("no clear call-to-action")
    if not has_form:
        weaknesses.append("no contact or lead form visible")
    if len(summary) < 200:
        weaknesses.append("very thin website content")
    weaknesses_str = ", ".join(weaknesses) if weaknesses else "could benefit from a modern design refresh"

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
        # Override client type if campaign has a specific type set (and not generic)
        if campaign_config.get("campaign_type") and campaign_config["campaign_type"] != "generic":
            client_type = campaign_config["campaign_type"]
            angle = CLIENT_TYPE_ANGLES.get(client_type, CLIENT_TYPE_ANGLES["generic"])

    # Build optional sections
    demo_section = ""
    if demo_link:
        demo_section = f"""
--- DEMO / APP LINK ---
Include this link naturally in the email as a demo or preview: {demo_link}
Do NOT just paste it — weave it into the conversation, like "I put together a quick preview for you: {demo_link}"
"""

    pitch_section = ""
    if pitch_message:
        pitch_section = f"""
--- CUSTOM PITCH CONTEXT ---
Use the following key message/pitch naturally in the email:
{pitch_message}
"""

    return f"""
You are a top-tier B2B sales rep at {product_name}, writing a highly personalized cold email to a potential client.

{product_name} is {product_desc}
Our website: {company_website}

--- CLIENT CONTEXT ---
Client Name: {name}
Website: {url}
Industry Type: {client_type.replace("_", " ").title()}
Page Title: {title}
Key Headings: {headings}
Website Summary: {summary}

Observed Website Weaknesses: {weaknesses_str}

--- INDUSTRY PAIN POINTS TO ADDRESS ---
{angle["pain_points"]}

--- VALUE WE OFFER FOR THIS CLIENT TYPE ---
{angle["value_prop"]}

--- CALL TO ACTION ---
{angle["cta"]}
{demo_section}{pitch_section}
--- EMAIL RULES (STRICTLY FOLLOW) ---
- You MUST write the Subject line FIRST as: Subject: [Your subject here]
- Then write the email body below it
- Max 130 words for the body
- Max 5–6 lines
- NO bullet points, NO bold (**), NO markdown
- Conversational and warm tone — NOT corporate or robotic
- Sound like a real human, not a bot
- Reference something SPECIFIC about their website or business (use the page title or headings)
- Personalize the opening line using their name or business context
- End with the CTA above
- Do NOT mention competitors
- Do NOT use phrases like "I hope this email finds you well"
- DO NOT use ALL CAPS for emphasis

Write the email now:
"""


async def generate_email(name: str, url: str, analysis: dict, client_type: str = "generic", campaign_config: dict = None) -> tuple[str, str]:
    """
    Returns (subject, body) tuple.
    If campaign_config is provided, its values override .env defaults.
    """
    prompt = build_prompt(name, url, analysis, client_type, campaign_config)

    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.85,
        max_tokens=400
    )

    content = response.choices[0].message.content.strip()

    # Parse subject and body
    lines = content.split("\n")
    subject = ""
    body_lines = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.lower().startswith("subject:"):
            subject = stripped[len("subject:"):].strip()
        elif subject:
            body_lines.append(line)

    # Fallback if no subject line found
    if not subject:
        subject = f"Quick thought about {name}'s website"
        body_lines = lines

    # Clean body: remove markdown artifacts
    cleaned_body = []
    for line in body_lines:
        line = line.replace("**", "").replace("__", "")
        if line.strip().startswith("- "):
            continue
        cleaned_body.append(line)

    body = "\n".join(cleaned_body).strip()

    return subject, body