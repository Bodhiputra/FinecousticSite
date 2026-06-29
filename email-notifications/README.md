# Shopify email templates (local source of truth)

Shopify does **not** sync notification or campaign email templates through the theme or Shopify CLI. These files live in git so you can edit in VS Code/Cursor, review diffs, and paste into Admin when ready.

## Two different systems

| Type | Admin path | In this repo | API / CLI sync |
|------|------------|--------------|----------------|
| **Transactional** (order confirmation, shipping, refund) | Settings → Notifications → *template* → Edit code | `email-notifications/templates/*.liquid` | **No** — manual paste only |
| **Marketing campaigns** (Shopify Messaging) | Apps → Messaging → Create campaign → Code your own | `email-campaigns/templates/*.html` | **No** — import `.html` manually |

References:

- [Customizing notification templates](https://help.shopify.com/en/manual/orders/notifications/edit-template)
- [Notification Liquid variables](https://help.shopify.com/en/manual/fulfillment/setup/notifications/email-variables)
- [Shopify Messaging campaigns](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/shopify-messaging/email/create-email/create-campaigns)
- [Community: no Admin API for notification templates](https://community.shopify.com/t/feature-request-api-support-for-email-notification-templates-version-control-automation/614205)

Background colors are **not** in the Liquid body — they come from Shopify’s hosted `/assets/notifications/styles.css`. Override them in the template `<style>` block; see `shared/notification-style-block.liquid`.

## Workflow (transactional)

1. Edit `templates/order-confirmation.liquid` (or another template file) locally.
2. Merge shared styles from `shared/notification-style-block.liquid` into the `<style>` tag in `<head>`.
3. Admin → **Settings → Notifications** → open the matching template → **Edit code**.
4. Paste **Email body (HTML)** from the local file → **Save**.
5. Send a **test order** email (preview in admin is incomplete for backgrounds and Liquid branches).

Pull from Admin (when Shopify has newer defaults):

1. Open template in Admin → Edit code → copy full HTML into the matching local file.
2. Re-apply your edits from git if needed.

## Workflow (marketing campaigns)

1. Edit `../email-campaigns/templates/your-campaign.html`.
2. Messaging → **Create campaign** → **Code your own** → paste HTML, or use **Import** (`.html` only).
3. Campaign content is **not** stored in the theme repo on Shopify’s side — keep the canonical copy here.

## Finecoustic brand defaults

Set in Admin → Settings → Notifications → **Customize email templates**:

- Logo: store logo
- Accent color: `#FFD300` (matches `--fc-yellow` in `assets/custom-style.css`)

Email background overrides use `#000000` in `shared/notification-style-block.liquid`.

## Why `#ffffff` is not searchable in Admin code

The white panels are defined in Shopify’s external stylesheet, not as hex values in your template. Add overrides in `<style>` — do not search for `ffffff`.
