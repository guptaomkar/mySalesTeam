# services/scoring.py

def score_lead(analysis):
    score = 0

    text = analysis["summary"].lower()

    # Weak content
    if len(text) < 300:
        score += 2

    # Poor structure
    if len(analysis["headings"]) < 3:
        score += 2

    # Missing modern keywords (important)
    if "interactive" not in text:
        score += 1
    if "modern" not in text:
        score += 1
    if "luxury" not in text:
        score += 1

    # No CTA signals
    if "contact" not in text and "enquiry" not in text:
        score += 2

    # FINAL DECISION
    if score >= 5:
        return "HIGH"
    elif score >= 3:
        return "MEDIUM"
    else:
        return "LOW"