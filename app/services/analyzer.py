# app/services/analyzer.py
from bs4 import BeautifulSoup


# ========================
# CLIENT TYPE KEYWORDS
# ========================
CLIENT_TYPE_KEYWORDS = {
    "real_estate": [
        "property", "properties", "real estate", "apartment", "villa", "plot",
        "flat", "flats", "buy home", "rent", "residential", "commercial", "realty",
        "developer", "developers", "housing", "sq ft", "sqft", "rera", "builder"
    ],
    "restaurant": [
        "restaurant", "cafe", "menu", "food", "dining", "cuisine", "chef",
        "table booking", "reservation", "dine", "takeaway", "delivery", "biryani",
        "pizza", "burger", "eat", "bar", "grill", "kitchen"
    ],
    "ecommerce": [
        "shop", "store", "cart", "checkout", "buy now", "add to cart", "product",
        "order", "delivery", "shipping", "price", "discount", "offer", "sale",
        "catalogue", "catalog", "wishlist", "payment"
    ],
    "saas": [
        "saas", "software", "platform", "dashboard", "api", "integration",
        "subscription", "trial", "free trial", "pricing plan", "features",
        "automation", "workflow", "cloud", "app", "solution", "tool"
    ],
    "agency": [
        "agency", "digital marketing", "branding", "design", "creative",
        "seo", "ppc", "social media", "marketing", "campaign", "strategy",
        "web design", "web development", "portfolio", "services", "clients"
    ],
    "portfolio": [
        "portfolio", "my work", "projects", "hire me", "freelance", "designer",
        "developer", "resume", "cv", "about me", "gallery"
    ],
}


def detect_client_type(title: str, headings: list, text: str) -> str:
    """
    Classify a website into a client type based on keyword matching.
    Returns the best-matched type or 'generic'.
    """
    combined = (title + " " + " ".join(headings) + " " + text).lower()

    scores = {}
    for client_type, keywords in CLIENT_TYPE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in combined)
        scores[client_type] = score

    best_type = max(scores, key=scores.get)

    # Only use detected type if score is meaningful
    if scores[best_type] >= 2:
        return best_type

    return "generic"


def analyze_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    headings = [h.text.strip() for h in soup.find_all(["h1", "h2", "h3"])[:8] if h.text.strip()]

    paragraphs = [p.text.strip() for p in soup.find_all("p")[:15] if p.text.strip()]
    text = " ".join(paragraphs)

    # Detect links count (CTA signal)
    links = soup.find_all("a")
    has_cta = any(
        kw in (a.text or "").lower()
        for a in links
        for kw in ["contact", "book", "enquiry", "get started", "buy", "order", "free trial"]
    )

    # Detect forms (another CTA signal)
    has_form = bool(soup.find("form"))

    # Detect client type
    client_type = detect_client_type(title, headings, text)

    # Basic quality score
    score = 0
    if len(text) < 300:
        score += 2
    if len(headings) < 3:
        score += 2
    if not has_cta:
        score += 2
    if not has_form:
        score += 1
    if "modern" not in text.lower():
        score += 1
    if "interactive" not in text.lower():
        score += 1

    return {
        "title": title,
        "headings": headings,
        "summary": text[:1000],
        "score": score,
        "has_cta": has_cta,
        "has_form": has_form,
        "client_type": client_type,
    }