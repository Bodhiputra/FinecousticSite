# Shopify Store Development Rules

## Session Start (Every Session — Required)
1. Read `context/shopify-context.md` — rolling state, last decisions, in-progress work
2. Read `context/codebase-summary.md` — semantic map of what every section, snippet, asset, and template does. Load this instead of reading source files cold.
3. Run full codebase index: `find . -type f | grep -v node_modules | grep -v ".git/" | sort > context/codebase-index.md` — write to file, do NOT dump into context window. Read specific parts from it only when needed.

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

## Shopify CSS Placement Rules (Hard Rules)

Shopify enforces a **500-character total limit** on the `custom_css` array per section instance in JSON templates. Violating this causes upload errors.

**Where CSS belongs — always follow this before writing any style:**

| CSS type | Where it goes |
|---|---|
| Default styles for a section | `{% stylesheet %}` block inside the section's `.liquid` file |
| Global overrides across all sections | `assets/custom-style.css` |
| Targeting one specific section instance by DOM ID | `assets/custom-style.css` using `#shopify-section-[template-id]__[section-id]` |
| Tiny, instance-specific tweaks only (margin, max-width) | `custom_css` in the JSON template — max ~3 short entries |

**Never put into `custom_css`:** button styles, hover states, media queries, pseudo-elements (`::after`, `::before`), or anything over ~150 characters per entry.

## When in Doubt: STOP and Ask
Better to ask than to mess something up.
