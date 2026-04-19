# app/services/email_sender.py
import aiosmtplib
import asyncio
import os
import time
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr, formatdate, make_msgid

from app.config import (
    EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS,
    GMAIL_HOST, GMAIL_PORT, GMAIL_USER, GMAIL_PASS,
    EMAIL_FROM_NAME, MAX_EMAILS_PER_HOUR, PRODUCT_NAME, COMPANY_WEBSITE
)

sent_count = 0
sent_count_reset_time = time.time()


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:30px 10px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;">
          <!-- Body -->
          <tr>
            <td style="padding:20px 30px 10px 30px;font-size:15px;line-height:1.75;color:#1a1a1a;">
              {body_html}
            </td>
          </tr>
          <!-- Signature divider -->
          <tr>
            <td style="padding:10px 30px;">
              <hr style="border:none;border-top:1px solid #eeeeee;margin:0;">
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="padding:10px 30px 20px 30px;font-size:13px;color:#555555;line-height:1.6;">
              <strong style="color:#1a1a1a;">{from_name}</strong><br>
              <a href="{company_website}" style="color:#6366f1;text-decoration:none;">{company_website}</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:10px 30px 20px 30px;font-size:11px;color:#aaaaaa;text-align:center;">
              You're receiving this email because your business might benefit from our services.
              To unsubscribe, reply with "Unsubscribe" in the subject.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def text_to_html_paragraphs(body_text: str) -> str:
    """Convert plain text body to simple HTML paragraphs."""
    lines = body_text.strip().split("\n")
    html_parts = []
    for line in lines:
        line = line.strip()
        if line:
            html_parts.append(f"<p style='margin:0 0 12px 0;'>{line}</p>")
        else:
            html_parts.append("<br>")
    return "\n".join(html_parts)


async def send_email(to_email: str, subject: str, body: str, attachments: list = None, sender_name_override: str = None) -> None:
    """
    Send an anti-spam-friendly HTML email.
    Optionally attach files from data/attachments/ directory.
    Raises exception on failure (caller handles logging).
    """
    global sent_count, sent_count_reset_time

    # Rate limit: reset counter after 1 hour
    now = time.time()
    if now - sent_count_reset_time >= 3600:
        sent_count = 0
        sent_count_reset_time = now

    if sent_count >= MAX_EMAILS_PER_HOUR:
        wait_secs = 3600 - (now - sent_count_reset_time)
        await asyncio.sleep(wait_secs)
        sent_count = 0
        sent_count_reset_time = time.time()

    # Build HTML body
    body_html = text_to_html_paragraphs(body)
    html_content = HTML_TEMPLATE.format(
        subject=subject,
        body_html=body_html,
        from_name=EMAIL_FROM_NAME,
        company_website=COMPANY_WEBSITE
    )

    # Build MIME message — use mixed if we have attachments, alternative otherwise
    if attachments:
        msg = MIMEMultipart("mixed")
        # Create the alternative sub-part for text/html
        msg_alt = MIMEMultipart("alternative")
        plain_part = MIMEText(body, "plain", "utf-8")
        html_part = MIMEText(html_content, "html", "utf-8")
        msg_alt.attach(plain_part)
        msg_alt.attach(html_part)
        msg.attach(msg_alt)
    else:
        msg = MIMEMultipart("alternative")

    # Decide which SMTP credentials to use
    use_gmail = "gmail.com" in to_email.lower()
    smtp_host = GMAIL_HOST if use_gmail else EMAIL_HOST
    smtp_port = GMAIL_PORT if use_gmail else EMAIL_PORT
    smtp_user = GMAIL_USER if use_gmail else EMAIL_USER
    smtp_pass = GMAIL_PASS if use_gmail else EMAIL_PASS

    from_name = sender_name_override if sender_name_override else EMAIL_FROM_NAME
    msg["Message-ID"] = make_msgid(domain=smtp_user.split("@")[-1])
    msg["Date"] = formatdate(localtime=True)
    msg["From"] = formataddr((from_name, smtp_user))
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Reply-To"] = smtp_user
    msg["MIME-Version"] = "1.0"
    msg["X-Mailer"] = "Outlook 16.0"
    msg["X-Priority"] = "3"
    msg["List-Unsubscribe"] = f"<mailto:{smtp_user}?subject=Unsubscribe>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

    # Plain text fallback + HTML (only if no attachments — already added above)
    if not attachments:
        plain_part = MIMEText(body, "plain", "utf-8")
        html_part = MIMEText(html_content, "html", "utf-8")
        msg.attach(plain_part)
        msg.attach(html_part)

    # Attach files if provided
    if attachments:
        attachments_dir = os.path.join(os.getcwd(), "data", "attachments")
        for att_filename in attachments:
            att_path = os.path.join(attachments_dir, att_filename)
            if os.path.exists(att_path):
                with open(att_path, "rb") as f:
                    att_data = f.read()
                # Use original filename (strip the uuid prefix)
                display_name = "_".join(att_filename.split("_")[1:]) if "_" in att_filename else att_filename
                att_part = MIMEApplication(att_data, Name=display_name)
                att_part["Content-Disposition"] = f'attachment; filename="{display_name}"'
                msg.attach(att_part)

    MAX_RETRIES = 1
    retry_count = 0
    while retry_count <= MAX_RETRIES:
        try:
            await aiosmtplib.send(
                msg,
                hostname=smtp_host,
                port=smtp_port,
                start_tls=True,
                use_tls=False,
                username=smtp_user,
                password=smtp_pass,
            )
            break
        except aiosmtplib.SMTPResponseException as e:
            # Common Gmail rate limit / too fast codes
            if e.code in [421, 450, 452, 550] and retry_count < MAX_RETRIES:
                retry_count += 1
                await asyncio.sleep(60) # Pause for 1 minute before retry
            else:
                raise

    sent_count += 1