# Demo account playbooks (demo.heyopsy.com)

Sales and support guide for provisioning and running demos on the public demo site.

## Environment basics

- **URL:** https://demo.heyopsy.com
- **Who can create users:** Super admins only (Users admin in the app)
- **Outbound email:** Disabled (SES and Customer.io suppressed)
- **Public signup:** Disabled
- **Daily reset:** Full database teardown and re-seed at **06:00 UTC** every day

After 06:00 UTC, all runtime-provisioned prospect accounts are removed. Re-provision before important demos or tell prospects credentials expire overnight.

Baseline seed accounts (always present after reset):

| Login | Password | Role |
|-------|----------|------|
| `agent@opsy.com` | `12345678` | Agent (Win plan, ~100 basic client properties) |
| `firstname.lastname@email.com` (seed homeowners) | `12345678` | Homeowner (one basic property each) |

Seed homeowners do **not** include rich sample data (maintenance, conversations, inspections). Use runtime provisioning for sales demos.

---

## Playbook 1: Agent-only demo

**When:** Selling to agents; show portfolio, broadcasts, client list, inspections, maintenance from the agent view.

**Steps:**

1. Sign in as super admin on demo.heyopsy.com
2. Users → New user
3. Enable **Provision ready-to-use demo account**
4. Role: **Agent**
5. Optionally disable **Include paired homeowner login** if you will not show the homeowner side
6. Set prospect email/name and generate a login password
7. Share agent credentials with the prospect

**What they get:** Win plan, 3 rich sample properties with synthetic clients (background data only unless paired login is enabled).

---

## Playbook 2: Homeowner-only demo

**When:** Selling to homeowners; show Maintain plan and homeowner-centric workflows.

**Steps:**

1. Users → New user → **Provision ready-to-use demo account**
2. Role: **Homeowner**
3. Set prospect email/name and login password

**What they get:** Maintain plan, 1 rich sample property, shared demo agent persona (Sarah Chen).

---

## Playbook 3: Bilateral demo (agent + homeowner)

**When:** Same sales call shows both agent and homeowner views (messaging, shared property, broadcasts from both sides).

**Steps:**

1. Users → New user → **Provision ready-to-use demo account**
2. Role: **Agent**
3. Keep **Include paired homeowner login** enabled (default)
4. Set prospect agent email/name and login password
5. After provisioning completes, copy **both** credential blocks:
   - **Agent** — prospect’s email and password
   - **Paired homeowner** — synthetic client on the messages-focused property (same password by default)

**Demo flow tip:** Log in as agent first, then open a private/incognito window and log in as the paired homeowner to show both UIs.

**Reset between calls:** The paired homeowner can use Settings → Configuration → **Reset demo profile** to wipe activity data while keeping login and the base property.

---

## Restrictions on demo (vs production)

| Feature | Demo behavior |
|---------|----------------|
| Signup / invitations to new users | Blocked |
| Outbound email | Suppressed |
| Calendar OAuth (Google / Outlook) | Blocked |
| User creation | Super admin only |
| Role changes | Locked on provisioned users |
| Account data | Wiped daily at 06:00 UTC |

---

## Do not use for sales demos

- **`hello-homeowner@heyopsy.com`** — legacy single shared account with manual reset; not isolated per prospect
- **Seed homeowners (`demo-hw-001`, etc.)** — basic data only, not a substitute for provisioned demos
- **One shared homeowner login across multiple prospects** — causes data collisions and broken demo stories

---

## Provisioning checklist

- [ ] Confirm demo is before or after 06:00 UTC reset window
- [ ] Choose playbook (agent-only, homeowner-only, bilateral)
- [ ] Copy login password(s) from user detail after provisioning
- [ ] For bilateral: copy paired homeowner email from credential panel
- [ ] Tell prospect email is not sent on demo
