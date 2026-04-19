# app/services/scraper.py
import asyncio
import aiohttp

# User-agent to appear as a real browser
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


async def scrape_with_aiohttp(url: str) -> str:
    """
    Fetch a webpage using aiohttp (no subprocess = works on all platforms).
    Follows redirects and handles basic SSL.
    """
    timeout = aiohttp.ClientTimeout(total=15)
    async with aiohttp.ClientSession(headers=HEADERS, timeout=timeout) as session:
        async with session.get(url, ssl=False, allow_redirects=True) as res:
            # Try to detect encoding
            content_type = res.headers.get("Content-Type", "")
            if "charset=" in content_type:
                enc = content_type.split("charset=")[-1].strip()
            else:
                enc = "utf-8"
            return await res.text(encoding=enc, errors="replace")


async def get_website_content(url: str) -> str:
    """
    Main entry point for fetching website HTML.
    Uses aiohttp only (no Playwright subprocess — compatible with Windows ASGI).
    Falls back with a shorter timeout on failure.
    """
    if not url:
        return ""

    # Ensure URL has scheme
    if not url.startswith("http"):
        url = "https://" + url

    try:
        return await scrape_with_aiohttp(url)
    except Exception as e:
        # Try http:// fallback
        try:
            http_url = url.replace("https://", "http://")
            return await scrape_with_aiohttp(http_url)
        except Exception:
            return ""