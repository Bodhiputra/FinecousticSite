#!/usr/bin/env node
/**
 * Create/update footer-bottom-bar navigation menu in Shopify Admin.
 * Theme footer reads this menu via section setting bottom_nav_menu.
 *
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';
const MENU_HANDLE = 'footer-bottom-bar';
const MENU_TITLE = 'Footer bottom bar';

const ITEMS = [
  { title: 'About Us', url: '/pages/about-us' },
  { title: 'Policies', url: '/pages/policies' },
  { title: 'Support', url: '/pages/support' },
];

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const STORE = process.env.SHOPIFY_STORE;

if (!TOKEN || !STORE) {
  console.error(`Missing credentials in ${ENV_PATH}`);
  process.exit(1);
}

async function gql(query, variables = {}) {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

async function findMenu() {
  const data = await gql(`query { menus(first: 50) { nodes { id handle title } } }`);
  return data.menus.nodes.find((m) => m.handle === MENU_HANDLE);
}

async function main() {
  const existing = await findMenu();
  const items = ITEMS.map((item) => ({
    title: item.title,
    type: 'HTTP',
    url: item.url,
  }));

  if (existing) {
    const result = await gql(
      `mutation ($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, items: $items) {
          menu { handle title }
          userErrors { field message }
        }
      }`,
      { id: existing.id, title: MENU_TITLE, items }
    );
    const errors = result.menuUpdate.userErrors;
    if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '));
    console.log(`Updated menu: ${MENU_HANDLE}`);
    return;
  }

  const result = await gql(
    `mutation ($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
      menuCreate(title: $title, handle: $handle, items: $items) {
        menu { handle title }
        userErrors { field message }
      }
    }`,
    { title: MENU_TITLE, handle: MENU_HANDLE, items }
  );
  const errors = result.menuCreate.userErrors;
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '));
  console.log(`Created menu: ${MENU_HANDLE}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
