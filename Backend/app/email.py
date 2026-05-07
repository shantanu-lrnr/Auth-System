import logging
import os
from email.message import EmailMessage

import aiosmtplib

logger = logging.getLogger(__name__)

GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
GMAIL_FROM = os.environ.get("GMAIL_FROM", GMAIL_USER)
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:5173")

if not GMAIL_USER or not GMAIL_APP_PASSWORD:
    raise RuntimeError(
        "GMAIL_USER and GMAIL_APP_PASSWORD must be set in the environment "
        "(see .env at the repo root)."
    )


async def send_email(to: str, subject: str, html: str) -> None:
    message = EmailMessage()
    message["From"] = GMAIL_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content("This email requires an HTML-capable client.")
    message.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=GMAIL_USER,
            password=GMAIL_APP_PASSWORD,
        )
    except Exception:
        logger.exception("Failed to send email to %s", to)


def render_action_email(
    *,
    name: str,
    heading: str,
    intro: str,
    button_label: str,
    button_url: str,
    footnote: str,
) -> str:
    """Render a branded transactional email with a single call-to-action button.

    Uses table-based layout + inline styles for maximum email-client support
    (Gmail, Outlook, Apple Mail strip <style> blocks and most CSS).
    """
    return f"""\
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b0b14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b0b14;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:linear-gradient(180deg,#13131f 0%,#0f0f1a 100%);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.4);">
            <tr>
              <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#6366f1 100%);padding:32px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:18px;font-weight:600;color:#ffffff;letter-spacing:0.3px;">
                      Auth&nbsp;System
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:40px 40px 8px 40px;">
                <h1 style="margin:0 0 8px 0;font-size:24px;line-height:1.3;font-weight:700;color:#ffffff;">
                  {heading}
                </h1>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#cbd5e1;">
                  Hi {name},
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 40px 32px 40px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#cbd5e1;">
                  {intro}
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:0 40px 32px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:linear-gradient(135deg,#7c3aed 0%,#6366f1 100%);box-shadow:0 6px 20px rgba(124,58,237,0.35);">
                      <a href="{button_url}"
                         target="_blank"
                         style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                        {button_label}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 32px 40px;">
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#94a3b8;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#7c3aed;word-break:break-all;">
                  <a href="{button_url}" style="color:#a78bfa;text-decoration:none;">{button_url}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 32px 40px;">
                <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 40px 40px 40px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                  {footnote}
                </p>
              </td>
            </tr>
          </table>

          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin-top:24px;">
            <tr>
              <td align="center" style="font-size:11px;color:#475569;line-height:1.6;">
                Sent by Auth System · This is an automated message, please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
