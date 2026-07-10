#!/usr/bin/env node
/**
 * Set Hako Nomad pricing in Shopify Admin.
 *
 * hako-nomad-fbs1:  $68.80 (original — no compare-at)
 * hako-nomad-l-fbs2: $128.80 (original — no compare-at)
 *
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 * Usage: node tools/update-hako-prices.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';
const DRY_RUN = process.argv.includes('--dry-run');

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
  console.error(`Missing SHOPIFY_ADMIN_TOKEN or SHOPIFY_STORE in ${ENV_PATH}`);
  process.exit(1);
}

/** handle → { price, compareAtPrice } strings for Admin API (null clears compare-at) */
const PRICING_BY_HANDLE = {
  'hako-nomad-fbs1': { price: '68.80', compareAtPrice: null },
  'hako-nomad-l-fbs2': { price: '128.80', compareAtPrice: null },
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

async function getProductByHandle(handle) {
  const data = await gql(
    `query ($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        variants(first: 1) {
          nodes { id price compareAtPrice }
        }
      }
    }`,
    { handle }
  );
  return data.productByHandle;
}

async function updateVariant(productId, variantId, pricing) {
  const variantInput = {
    id: variantId,
    price: pricing.price,
  };
  if (pricing.compareAtPrice === null) {
    variantInput.compareAtPrice = null;
  } else if (pricing.compareAtPrice !== undefined) {
    variantInput.compareAtPrice = pricing.compareAtPrice;
  }

  const data = await gql(
    `mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price compareAtPrice }
        userErrors { field message }
      }
    }`,
    {
      productId,
      variants: [variantInput],
    }
  );
  const errs = data.productVariantsBulkUpdate.userErrors;
  if (errs?.length) throw new Error(errs.map((e) => e.message).join('; '));
  return data.productVariantsBulkUpdate.productVariants[0];
}

async function main() {
  for (const [handle, pricing] of Object.entries(PRICING_BY_HANDLE)) {
    const product = await getProductByHandle(handle);
    if (!product) {
      console.error(`Product not found: ${handle}`);
      continue;
    }
    const variant = product.variants.nodes[0];
    if (!variant) {
      console.error(`No variants for ${handle}`);
      continue;
    }

    console.log(
      `${handle}: ${variant.price} / ${variant.compareAtPrice || '—'} → ${pricing.price} / ${pricing.compareAtPrice ?? '—'}`
    );

    if (DRY_RUN) continue;

    const updated = await updateVariant(product.id, variant.id, pricing);
    console.log(`  ✓ Updated ${product.title}: $${updated.price}${updated.compareAtPrice ? ` (was $${updated.compareAtPrice})` : ''}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
