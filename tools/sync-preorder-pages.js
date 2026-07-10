#!/usr/bin/env node
/**
 * Create/update pre-order flow pages in Shopify Admin.
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

const PAGES = [
  { title: 'Pre-order Offers', handle: 'preorder-offers', templateSuffix: 'preorder-offers' },
  { title: 'Pre-order Questionnaire', handle: 'preorder-questionnaire', templateSuffix: 'preorder-questionnaire' },
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

async function findPageByHandle(handle) {
  const data = await gql(
    `query ($q: String!) {
      pages(first: 1, query: $q) {
        nodes { id handle title templateSuffix }
      }
    }`,
    { q: `handle:${handle}` }
  );
  return data.pages.nodes[0] || null;
}

async function upsertPage({ title, handle, templateSuffix }) {
  const existing = await findPageByHandle(handle);

  if (existing) {
    const result = await gql(
      `mutation ($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) {
          page { id handle title templateSuffix }
          userErrors { field message }
        }
      }`,
      {
        id: existing.id,
        page: { title, templateSuffix, isPublished: true },
      }
    );
    const errors = result.pageUpdate.userErrors;
    if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '));
    console.log(`Updated page: /pages/${handle} (template: ${templateSuffix})`);
    return result.pageUpdate.page;
  }

  const result = await gql(
    `mutation ($page: PageCreateInput!) {
      pageCreate(page: $page) {
        page { id handle title templateSuffix }
        userErrors { field message }
      }
    }`,
    {
      page: { title, handle, templateSuffix, isPublished: true },
    }
  );
  const errors = result.pageCreate.userErrors;
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '));
  console.log(`Created page: /pages/${handle} (template: ${templateSuffix})`);
  return result.pageCreate.page;
}

async function main() {
  for (const page of PAGES) {
    await upsertPage(page);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
