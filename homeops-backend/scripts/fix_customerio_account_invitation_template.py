#!/usr/bin/env python3
"""One-shot: patch Customer.io template 30 (Account Invitation Email) liquid variables."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ENVIRONMENT_ID = os.environ.get("CUSTOMER_IO_ENVIRONMENT_ID", "218445")
TEMPLATE_ID = os.environ.get("CUSTOMER_IO_ACCOUNT_INVITATION_TEMPLATE_ID", "30")
API_BASE = os.environ.get("CUSTOMER_IO_API_BASE", "https://fly.customer.io")

REPLACEMENTS = [
    (
        '{{senderFirstName | default: "Kino"}}',
        '{{ event.senderFirstName | default: "HomeOps Team" }}',
    ),
    (
        "{{avatarUrl | default: 'https://heyopsy.com/email/opsy-mark.png'}}",
        "{{ event.avatarUrl | default: 'https://heyopsy.com/email/opsy-mark.png' }}",
    ),
    (
        '{{inviteeName | default: "[First Name]"}}',
        '{{ event.inviteeName | default: event.recipientFirstName | default: "[First Name]" }}',
    ),
    ('href="{{inviteUrl}}"', 'href="{{ event.inviteUrl }}"'),
]


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
        raise SystemExit(f"Customer.io API {err.code}: {detail[:500]}") from err


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    current = api_request(
        "GET",
        f"/v1/environments/{ENVIRONMENT_ID}/templates/{TEMPLATE_ID}",
    )
    body = current.get("template", {}).get("body") or ""
    if not body:
        raise SystemExit("Template body not found in API response")

    patched = body
    for old, new in REPLACEMENTS:
        if old not in patched:
            print(f"WARNING: pattern not found: {old!r}", file=sys.stderr)
        patched = patched.replace(old, new)

    if patched == body:
        print("No changes needed.")
        return

    payload = {"template": {"body": patched}}
    if dry_run:
        print(json.dumps({"would_update": True, "replacements": len(REPLACEMENTS)}, indent=2))
        return

    result = api_request(
        "PUT",
        f"/v1/environments/{ENVIRONMENT_ID}/templates/{TEMPLATE_ID}",
        payload,
    )
    print(json.dumps({"updated": True, "template_id": TEMPLATE_ID, "id": result.get("template", {}).get("id")}, indent=2))


if __name__ == "__main__":
    main()
