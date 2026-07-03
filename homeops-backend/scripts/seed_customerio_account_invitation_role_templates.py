#!/usr/bin/env python3
"""Create or update Customer.io account invitation templates by role (homeowner, admin)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ENVIRONMENT_ID = os.environ.get("CUSTOMER_IO_ENVIRONMENT_ID", "218445")
API_BASE = os.environ.get("CUSTOMER_IO_API_BASE", "https://fly.customer.io")
BRAND_MARK_URL = os.environ.get(
    "EMAIL_ACCOUNT_INVITATION_MARK_URL", "https://app.heyopsy.com/opsy_favicon.png"
)
LEGACY_MARK_URL = "https://heyopsy.com/email/opsy-mark.png"
AVATAR_LIQUID = (
    f"{{{{ event.avatarUrl | replace: '{LEGACY_MARK_URL}', '{BRAND_MARK_URL}' "
    f"| default: '{BRAND_MARK_URL}' }}}}"
)

# Set after first create; update here once IDs are known.
TEMPLATE_IDS = {
    "homeowner": os.environ.get("CUSTOMER_IO_ACCOUNT_INVITATION_HOMEOWNER_TEMPLATE_ID", "31"),
    "admin": os.environ.get("CUSTOMER_IO_ACCOUNT_INVITATION_ADMIN_TEMPLATE_ID", "32"),
}

SHARED_HEAD = (
    """<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>An invitation from HomeOps</title>
  <style>
    body { margin:0; padding:0; background-color:#ffffff; }
    a { color:#1f3d36; }
    .serif { font-family: Georgia, 'Times New Roman', Times, serif; }
    @media only screen and (max-width: 600px) {
      .opsy-container { width:100% !important; }
      .opsy-pad { padding-left:24px !important; padding-right:24px !important; }
      .opsy-h1 { font-size:28px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#ffffff; font-size:1px; line-height:1px;">
    {preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="opsy-container" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px; max-width:600px; background-color:#ffffff; font-family:Georgia,'Times New Roman',Times,serif;">

          <tr>
            <td align="center" class="opsy-pad" style="padding:8px 56px 0;">
              <p style="margin:0; color:#b8863b; font-size:12px; letter-spacing:3px; text-transform:uppercase; font-family:Georgia,'Times New Roman',Times,serif;">
                An invitation from HomeOps
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" class="opsy-pad" style="padding:14px 56px 0;">
              <h1 class="opsy-h1" style="margin:0; color:#1f3d36; font-size:34px; line-height:1.2; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">
                {{ event.senderFirstName | default: "HomeOps Team" }} {headline_suffix}
              </h1>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 0 0;">
              <img src="__AVATAR_LIQUID__"
                   alt="Opsy" width="64"
                   style="display:inline-block; border:0; outline:none; width:64px; height:64px; border-radius:8px;" />
            </td>
          </tr>

          <tr>
            <td align="center" class="opsy-pad" style="padding:24px 56px 0;">
              <p style="margin:0; color:#1f3d36; font-size:20px; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">
                {subtitle}
              </p>
              <p style="margin:6px 0 0; color:#9a9a90; font-size:13px; font-family:Georgia,'Times New Roman',Times,serif;">
                Lets Be Good Ancestors. Lets Move Home Forward.
              </p>
            </td>
          </tr>

          <tr>
            <td class="opsy-pad" style="padding:32px 56px 0; color:#2f2f2f; font-size:16px; line-height:1.65; font-family:Georgia,'Times New Roman',Times,serif;">
              {body_html}
            </td>
          </tr>

          <tr>
            <td style="padding:32px 0 0;">
              <div style="height:22px; line-height:22px; font-size:0; background-color:#ece7d8;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td class="opsy-pad" style="padding:28px 56px 0; font-family:Georgia,'Times New Roman',Times,serif;">
              {features_html}
            </td>
          </tr>

          <tr>
            <td style="padding:28px 0 0;">
              <div style="height:22px; line-height:22px; font-size:0; background-color:#ece7d8;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 0 0;">
              <a href="{{ event.inviteUrl }}" target="_blank"
                 style="display:block; background-color:#1f3d36; color:#ffffff; text-align:center;
                        font-family:Georgia,'Times New Roman',Times,serif; font-size:20px; font-weight:700;
                        text-decoration:none; padding:20px 16px;">
                {cta_label}
              </a>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 16px 0;">
              <p style="margin:0; color:#9a9a90; font-size:13px; font-family:Georgia,'Times New Roman',Times,serif;">
                Takes about a minute &middot; Nothing to download
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:18px 16px 0;">
              <p style="margin:0; color:#1f3d36; font-size:20px; font-style:italic; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">
                Let's move home forward.
              </p>
              <p style="margin:10px 0 0; color:#b8863b; font-size:12px; letter-spacing:3px; text-transform:uppercase; font-family:Georgia,'Times New Roman',Times,serif;">
                Opsy by HomeOps
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
)


def feature_block(title: str, body: str) -> str:
    return f"""<p style="margin:0 0 4px; color:#1f3d36; font-size:18px; font-weight:700;">{title}</p>
              <p style="margin:0 0 22px; color:#3a3a3a; font-size:15px; line-height:1.6;">{body}</p>"""


TEMPLATES = {
    "homeowner": {
        "name": "Account Invitation — Homeowner",
        "subject": "You're invited to Opsy",
        "preheader": "Your home has a new home base on Opsy.",
        "headline_suffix": "set up something<br /><em style=\"font-weight:700;\">for your home.</em>",
        "subtitle": "Welcome home.",
        "body_html": """<p style="margin:0 0 18px;">Hi {{ event.inviteeName | default: event.recipientFirstName | default: "there" }},</p>
              <p style="margin:0 0 18px;">
                You're invited to Opsy — a calm place to track what your home needs, keep documents organized,
                and stay ahead of maintenance before it becomes a weekend you didn't plan for.
              </p>
              <p style="margin:0 0 10px; font-weight:700;">Here's what you're getting</p>
              <p style="margin:0 0 18px;">
                <strong>One organized home.</strong> Inspection reports, warranties, appliance details, and maintenance
                history — finally in one place instead of scattered folders and forgotten emails.
              </p>
              <p style="margin:0 0 8px;">
                Opsy watches the details so you don't have to remember every filter change, gutter cleaning,
                or water heater birthday. Gentle reminders when something matters — not another inbox you ignore.
              </p>""",
        "features_html": feature_block(
            "Everything about your home in one place.",
            "Documents, details, and home history — organized and easy to find when you need them.",
        )
        + feature_block(
            "Gentle reminders when something matters.",
            "When Opsy flags the water heater or the gutters, you hear about it before it becomes an emergency.",
        )
        + feature_block(
            "A trusted record you can build on for years.",
            "A living history of your home that grows with every update, repair, and season.",
        ),
        "cta_label": "Accept Your Invitation",
    },
    "admin": {
        "name": "Account Invitation — Admin",
        "subject": "You're invited to join the HomeOps team",
        "preheader": "You've been invited to join the HomeOps team on Opsy.",
        "headline_suffix": "added you<br /><em style=\"font-weight:700;\">to the team.</em>",
        "subtitle": "Welcome aboard.",
        "body_html": """<p style="margin:0 0 18px;">Hi {{ event.inviteeName | default: event.recipientFirstName | default: "there" }},</p>
              <p style="margin:0 0 18px;">
                You've been invited as an Opsy admin — to help homeowners and agents get organized,
                support the platform, and keep homes moving forward.
              </p>
              <p style="margin:0 0 10px; font-weight:700;">What you'll be part of</p>
              <p style="margin:0 0 18px;">
                <strong>You're joining the team behind the product.</strong> Opsy is how homes stay organized,
                agents stay useful between transactions, and homeowners stay ahead of what their house needs.
              </p>
              <p style="margin:0 0 8px;">
                As an admin, you'll help users get set up, keep accounts running smoothly,
                and shape how Opsy shows up for every home in the field.
              </p>""",
        "features_html": feature_block(
            "Manage users and accounts.",
            "Help homeowners and agents get onboarded, organized, and supported from day one.",
        )
        + feature_block(
            "Support homeowners and agents in the field.",
            "Be the person who makes sure Opsy works the way it's supposed to — for real homes, real clients.",
        )
        + feature_block(
            "Help shape how Opsy shows up for every home.",
            "Your work keeps the platform calm, useful, and moving home forward.",
        ),
        "cta_label": "Accept Invitation &amp; Set Up Account",
    },
}


def build_body(meta: dict) -> str:
    body = SHARED_HEAD.replace("__AVATAR_LIQUID__", AVATAR_LIQUID)
    for key in (
        "preheader",
        "headline_suffix",
        "subtitle",
        "body_html",
        "features_html",
        "cta_label",
    ):
        body = body.replace("{" + key + "}", meta[key])
    return body


def auth_header() -> str:
    token = os.environ.get("CUSTOMER_IO_WRITE_TOKEN", "").strip()
    if not token:
        raise SystemExit(
            "Set CUSTOMER_IO_WRITE_TOKEN (Customer.io App API bearer) to run this script."
        )
    return f"Bearer {token}"


def api_request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    data = None
    headers = {"Authorization": auth_header(), "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Customer.io API {err.code}: {detail[:800]}") from err


def upsert_template(role: str, meta: dict, dry_run: bool) -> int | None:
    template_id = TEMPLATE_IDS.get(role) or None
    payload = {
        "template": {
            "name": meta["name"],
            "subject": meta["subject"],
            "body": build_body(meta),
            "editor": "html",
            "template_type": "email",
        }
    }

    if dry_run:
        print(json.dumps({"role": role, "would_upsert": True, "template_id": template_id}, indent=2))
        return template_id

    if template_id:
        result = api_request(
            "PUT",
            f"/v1/environments/{ENVIRONMENT_ID}/templates/{template_id}",
            payload,
        )
        tid = int(result.get("template", {}).get("id") or template_id)
        print(f"Updated template {tid} ({role})")
        return tid

    result = api_request(
        "POST",
        f"/v1/environments/{ENVIRONMENT_ID}/templates",
        payload,
    )
    tid = int(result["template"]["id"])
    print(f"Created template {tid} ({role})")
    return tid


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    created: dict[str, int] = {}
    for role, meta in TEMPLATES.items():
        tid = upsert_template(role, meta, dry_run)
        if tid:
            created[role] = tid
    if created:
        print(json.dumps({"template_ids": created}, indent=2))


if __name__ == "__main__":
    main()
