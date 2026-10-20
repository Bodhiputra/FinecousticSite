#!/usr/bin/env node
/**
 * Create custom.purchase_mode product metafield definition and set Studio 301/302 to coming_soon.
 *
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 *
 * Usage:
 *   node tools/sync-purchase-mode-metafields.js [--dry-run]
 *
 * Admin: Products → [product] → Metafields → Purchase mode
 * Values: add_to_bag | coming_soon
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

const DEFINITION = {
  name: 'Purchase mode',
  namespace: 'custom',
  key: 'purchase_mode',
  type: 'single_line_text_field',
  description: 'Theme purchase CTA: add_to_bag (default) or coming_soon (price shown, no add to cart).',
};

const PRODUCT_VALUES = [
  { handle: 'hako-studio-301', value: 'coming_soon' },
  { handle: 'hako-studio-302', value: 'coming_soon' },
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  const data = Object.values(json.data || {})[0];
  if (data?.userErrors?.length) {
    throw new Error(data.userErrors.map((e) => e.message).join('; '));
  }
  return json.data;
}

async function ensureDefinition() {
  const query = `#graphql
    mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id name }
        userErrors { field message code }
      }
    }`;
  const variables = {
    definition: {
      name: DEFINITION.name,
      namespace: DEFINITION.namespace,
      key: DEFINITION.key,
      type: DEFINITION.type,
      description: DEFINITION.description,
      ownerType: 'PRODUCT',
      pin: true,
    },
  };
  if (DRY_RUN) {
    console.log('[dry-run] would create metafield definition', DEFINITION);
    return;
  }
  try {
    const data = await gql(query, variables);
    const err = data.metafieldDefinitionCreate?.userErrors || [];
    const already = err.some((e) => /taken|exists/i.test(e.message || ''));
    if (already) {
      console.log('Metafield definition already exists:', `${DEFINITION.namespace}.${DEFINITION.key}`);
      return;
    }
    if (err.length) throw new Error(err.map((e) => e.message).join('; '));
    console.log('Created metafield definition:', data.metafieldDefinitionCreate.createdDefinition?.name);
  } catch (e) {
    if (/taken|exists/i.test(String(e.message))) {
      console.log('Metafield definition already exists:', `${DEFINITION.namespace}.${DEFINITION.key}`);
      return;
    }
    throw e;
  }
}

async function productIdByHandle(handle) {
  const query = `#graphql
    query ($handle: String!) {
      productByHandle(handle: $handle) { id title }
    }`;
  const data = await gql(query, { handle });
  return data.productByHandle;
}

async function setProductMode(handle, value) {
  const product = await productIdByHandle(handle);
  if (!product?.id) {
    console.warn(`Skip ${handle}: product not found`);
    return;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] would set ${handle} purchase_mode=${value}`);
    return;
  }
  const mutation = `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key namespace value }
        userErrors { field message }
      }
    }`;
  await gql(mutation, {
    metafields: [
      {
        ownerId: product.id,
        namespace: DEFINITION.namespace,
        key: DEFINITION.key,
        type: DEFINITION.type,
        value,
      },
    ],
  });
  console.log(`Set ${handle} → purchase_mode=${value}`);
}

async function main() {
  await ensureDefinition();
  for (const row of PRODUCT_VALUES) {
    await setProductMode(row.handle, row.value);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
