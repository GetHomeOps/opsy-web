# Customer.io journey exit updates (manual reference)

Campaign exit conditions were updated via API for workspace `218445`:

| Campaign | ID | Exit events |
|----------|-----|-------------|
| New Property Added | 11 | `no_properties_remaining` (replaced `property_deleted`) |
| Property Invitation by Agent | 10 | `no_properties_remaining` (replaced `property_deleted`) |

## Email template CTA updates (Design Studio)

Update templates in Customer.io so CTAs use live person attributes instead of stale event payload.

### Template 28 — Email 1 ("Your home's first snapshot")

Replace CTA `href` values with:

```liquid
{% if customer.primary_property_url %}{{ customer.primary_property_url }}{% else %}https://app.heyopsy.com/home/properties/new{% endif %}
```

### Template 29 — Email 2 (seasonal maintenance)

Replace button link:

```liquid
{{ customer.primary_property_url | default: event.property_url | default: 'https://app.heyopsy.com/home/properties/new' }}
```

## Heal stuck profiles

After deploying app changes:

```bash
node homeops-backend/scripts/heal_customerio_stuck_profiles.js af.ordonezs@gmail.com
```
