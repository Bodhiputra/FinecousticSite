# Shopify Messaging (marketing email campaigns)

Marketing campaigns are **not** part of the Online Store theme. Shopify CLI (`shopify theme push`) does not upload them.

## Edit in codebase

Store campaign HTML here:

```
email-campaigns/templates/
  launch-announcement.html
  newsletter-june.html
```

## Publish to Shopify

1. Admin → **Apps → Messaging**
2. **Create campaign** → **Code your own**
3. Paste from local file, or **Import** an `.html` file from disk
4. Preview, schedule, send

There is **no Admin API** to create or update campaign HTML programmatically ([Shopify dev community](https://community.shopify.dev/t/is-there-a-way-to-send-emails-sms-via-shopify-api-programmatically/23356)).

## Alternatives for full automation

If you need git → deploy without manual paste:

- **Klaviyo / Mailchimp / Postmark** — design in repo or their editor; trigger via webhooks from Shopify orders/events
- **Custom app** — listen to webhooks, send your own HTML (parallel to Shopify notifications)

For transactional order emails, use `../email-notifications/` instead.
