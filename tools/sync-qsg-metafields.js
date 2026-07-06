#!/usr/bin/env node
/**
 * Create product metafield definition custom.quick_start_guide_url (url)
 * and sync QSG URLs from theme template data into Shopify Admin.
 *
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 *
 * Usage: node tools/sync-qsg-metafields.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

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
const DRY_RUN = process.argv.includes('--dry-run');

if (!TOKEN || !STORE) {
  console.error(`Missing SHOPIFY_ADMIN_TOKEN or SHOPIFY_STORE in ${ENV_PATH}`);
  process.exit(1);
}

/** Source of truth for one-time migration (matches former template JSON URLs). */
const QSG_BY_HANDLE = {
  'groove-anc-ft20': 'https://cdn.shopify.com/s/files/1/0661/0229/6650/files/GROOVE_ANC_FT20_QSG_20250626.pdf?v=1759915192',
  'groove-ows-ft21': 'https://cdn.shopify.com/s/files/1/0661/0229/6650/files/GROOVE_OWS_FT21_OSG_202509032.pdf?v=1760151795',
  'resono-wfm1': 'https://cdn.shopify.com/s/files/1/0661/0229/6650/files/WFM1_QSG_20250926.pdf?v=1762999963',
  'sonara-ufm1': 'https://cdn.shopify.com/s/files/1/0661/0229/6650/files/UFM1_QSG_20250926.pdf?v=1762999919',
  'hako-nomad-fbs1': 'https://cdn.shopify.com/s/files/1/0661/0229/6650/files/FBS1.jpg?v=1783310032',
  'hako-nomad-l-fbs2': 'https://cdn.shopify.com/s/files/1/0661/0229/6650/files/FBS2.jpg?v=1783310033',
};

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
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

async function ensureDefinition() {
  const check = await gql(`
    query {
      metafieldDefinitions(first: 1, ownerType: PRODUCT, namespace: "custom", key: "quick_start_guide_url") {
        nodes { id name }
      }
    }
  `);
  if (check.metafieldDefinitions.nodes.length) {
    console.log('Metafield definition already exists:', check.metafieldDefinitions.nodes[0].name);
    return;
  }
  if (DRY_RUN) {
    console.log('[dry-run] Would create metafield definition custom.quick_start_guide_url (url)');
    return;
  }
  const data = await gql(`
    mutation CreateQsgDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id name }
        userErrors { field message }
      }
    }
  `, {
    definition: {
      name: 'Quick Start Guide URL',
      namespace: 'custom',
      key: 'quick_start_guide_url',
      type: 'url',
      ownerType: 'PRODUCT',
      pin: true,
      access: { storefront: 'PUBLIC_READ' },
    },
  });
  const result = data.metafieldDefinitionCreate;
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '));
  }
  console.log('Created metafield definition:', result.createdDefinition.name);
}

async function syncProductMetafields() {
  const handles = Object.keys(QSG_BY_HANDLE);
  const query = `
    query ProductsByHandle($query: String!) {
      products(first: 1, query: $query) {
        nodes { id handle title }
      }
    }
  `;
  const metafields = [];
  for (const handle of handles) {
    const url = QSG_BY_HANDLE[handle];
    const data = await gql(query, { query: `handle:${handle}` });
    const product = data.products.nodes[0];
    if (!product) {
      console.warn(`Product not found: ${handle}`);
      continue;
    }
    metafields.push({
      ownerId: product.id,
      namespace: 'custom',
      key: 'quick_start_guide_url',
      type: 'url',
      value: url,
    });
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${handle} → ${url}`);
  }
  if (DRY_RUN || !metafields.length) return;
  const setData = await gql(`
    mutation SetQsgMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key value }
        userErrors { field message }
      }
    }
  `, { metafields });
  const result = setData.metafieldsSet;
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join('; '));
  }
  console.log(`Set ${result.metafields.length} product metafields.`);
}

async function main() {
  console.log(DRY_RUN ? 'Dry run — no Admin writes.' : 'Syncing QSG metafields to Admin…');
  await ensureDefinition();
  await syncProductMetafields();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
