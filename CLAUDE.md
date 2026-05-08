# Shopify Store Development Rules

## CRITICAL SAFETY RULES
- NEVER run mutations without asking me first
- NEVER delete products/collections without approval
- ALWAYS test changes on a development theme preview first
- ALWAYS commit changes to git before pushing to live store

## What You CAN Do Automatically
- Read products, collections, customers, orders (queries only)
- Edit Liquid templates, CSS, JavaScript in theme files
- Validate GraphQL queries before execution
- Run theme checks with `shopify theme check`
- Create/edit local files

## What Requires Explicit Approval
- Create new products
- Update product prices, inventory, titles, descriptions
- Create/modify collections
- Modify customer data
- Run any mutation (write operations)
- Update store settings or policies
- Publish changes to live store

## Testing Workflow
1. Make changes to local files
2. Ask me to review the changes
3. Run `shopify theme dev` in another terminal to preview
4. Show me the preview results
5. Only then ask to publish changes

## DANGER ZONE - NEVER TOUCH THESE
- config/settings_schema.json (modify only if I explicitly ask)
- Shopify CLI credentials or auth files
- Live theme without testing on dev theme first
- Customer payment or sensitive data

## Approved Commands You Can Execute
- `shopify theme check` (linting)
- `shopify theme preview` (showing preview URLs)
- File edits to theme files (Liquid, CSS, JS, JSON)
- GraphQL query validation (not execution)

## Git
- User does all git operations manually — do NOT run git add/commit/push

## Store
- Store: j5gawi-vu.myshopify.com

## When in Doubt: STOP and Ask
Better to ask than to mess something up.
