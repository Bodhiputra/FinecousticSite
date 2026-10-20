#!/usr/bin/env node
/**
 * Create product metafield definitions for PDP specs / in-the-box content
 * and migrate values from templates/product.*.json into Shopify Admin.
 *
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 *
 * Usage: node tools/sync-product-specs-metafields.js [--dry-run]
 *
 * Admin editing: Products → [product] → Metafields (pinned).
 * Spec tables: one row per line, "Label | Value".
 * In the box items (JSON): [{ "icon_asset": "FT20.webp", "icon_text": "GROOVE ANC FT20" }, ...]
 *   icon_asset is a theme assets filename (not a full URL).
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

const DEFINITIONS = [
  {
    name: 'Specs section title',
    namespace: 'custom',
    key: 'specs_section_title',
    type: 'single_line_text_field',
  },
  {
    name: 'Specifications table 1',
    namespace: 'custom',
    key: 'specs_table_1',
    type: 'multi_line_text_field',
  },
  {
    name: 'Specifications table 2',
    namespace: 'custom',
    key: 'specs_table_2',
    type: 'multi_line_text_field',
  },
  {
    name: 'Specs table 1 tab label',
    namespace: 'custom',
    key: 'specs_table_1_label',
    type: 'single_line_text_field',
  },
  {
    name: 'Specs table 2 tab label',
    namespace: 'custom',
    key: 'specs_table_2_label',
    type: 'single_line_text_field',
  },
  {
    name: 'In the box title',
    namespace: 'custom',
    key: 'inbox_title',
    type: 'single_line_text_field',
  },
  {
    name: 'In the box theme asset',
    namespace: 'custom',
    key: 'inbox_asset',
    type: 'single_line_text_field',
  },
  {
    name: 'In the box items',
    namespace: 'custom',
    key: 'in_the_box_items',
    type: 'json',
  },
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

function stripJsonCommentHeader(raw) {
  return raw.replace(/^\/\*[\s\S]*?\*\/\s*/, '');
}

function loadTemplatePayload(filename) {
  const filePath = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(stripJsonCommentHeader(fs.readFileSync(filePath, 'utf8')));
  const section = parsed.sections?.fc_pdp_unified;
  if (!section) return null;
  return {
    settings: section.settings || {},
    blocks: section.blocks || {},
    block_order: section.block_order || [],
  };
}

/** handle from product.groove-anc-ft20.json → groove-anc-ft20 */
function handleFromTemplateFile(filename) {
  const m = filename.match(/^product\.(.+)\.json$/);
  if (!m || m[1] === 'json') return null;
  return m[1];
}

function buildMigrationRows() {
  const rows = [];
  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.startsWith('product.') && f.endsWith('.json') && f !== 'product.json');

  for (const file of files) {
    const handle = handleFromTemplateFile(file);
    if (!handle) continue;
    const payload = loadTemplatePayload(file);
    if (!payload) continue;

    const s = payload.settings;
    const items = [];
    for (const blockId of payload.block_order) {
      const block = payload.blocks[blockId];
      if (!block || block.type !== 'inbox_item') continue;
      const iconAsset = (block.settings?.icon_asset || '').trim();
      const iconText = (block.settings?.icon_text || '').trim();
      if (!iconAsset && !iconText) continue;
      items.push({ icon_asset: iconAsset, icon_text: iconText });
    }

    rows.push({
      handle,
      fields: {
        specs_section_title: (s.table_title || 'Specifications').trim(),
        specs_table_1: (s.specs_table_1 || '').trim(),
        specs_table_2: (s.specs_table_2 || '').trim(),
        specs_table_1_label: (s.table1_button_label || '').trim(),
        specs_table_2_label: (s.table2_button_label || '').trim(),
        inbox_title: (s.inbox_title || 'In The Box').trim(),
        inbox_asset: (s.inbox_asset || '').trim(),
        in_the_box_items: items.length ? items : null,
      },
    });
  }
  return rows;
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
  return json.data;
}

async function ensureDefinitions() {
  for (const def of DEFINITIONS) {
    const check = await gql(
      `
      query CheckDef($namespace: String!, $key: String!) {
        metafieldDefinitions(first: 1, ownerType: PRODUCT, namespace: $namespace, key: $key) {
          nodes { id name key }
        }
      }
    `,
      { namespace: def.namespace, key: def.key },
    );
    if (check.metafieldDefinitions.nodes.length) {
      console.log(`Definition exists: ${def.namespace}.${def.key}`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] Would create ${def.namespace}.${def.key} (${def.type})`);
      continue;
    }
    const data = await gql(
      `
      mutation CreateDef($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition { id name key }
          userErrors { field message }
        }
      }
    `,
      {
        definition: {
          name: def.name,
          namespace: def.namespace,
          key: def.key,
          type: def.type,
          ownerType: 'PRODUCT',
          pin: def.key.startsWith('specs_') || def.key === 'in_the_box_items',
          access: { storefront: 'PUBLIC_READ' },
        },
      },
    );
    const result = data.metafieldDefinitionCreate;
    if (result.userErrors?.length) {
      throw new Error(result.userErrors.map((e) => e.message).join('; '));
    }
    console.log(`Created definition: custom.${result.createdDefinition.key}`);
  }
}

function metafieldInput(ownerId, key, type, value) {
  if (value === null || value === undefined || value === '') return null;
  if (type === 'json') {
    return {
      ownerId,
      namespace: 'custom',
      key,
      type: 'json',
      value: JSON.stringify(value),
    };
  }
  return {
    ownerId,
    namespace: 'custom',
    key,
    type,
    value: String(value),
  };
}

async function syncProducts(rows) {
  const typeByKey = Object.fromEntries(DEFINITIONS.map((d) => [d.key, d.type]));
  const allMetafields = [];

  for (const row of rows) {
    const data = await gql(
      `
      query ProductByHandle($query: String!) {
        products(first: 1, query: $query) {
          nodes { id handle title }
        }
      }
    `,
      { query: `handle:${row.handle}` },
    );
    const product = data.products.nodes[0];
    if (!product) {
      console.warn(`Product not found: ${row.handle}`);
      continue;
    }

    const inputs = [];
    for (const [key, value] of Object.entries(row.fields)) {
      const input = metafieldInput(product.id, key, typeByKey[key], value);
      if (input) inputs.push(input);
    }

    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${row.handle}: ${inputs.length} metafield(s)`);
    allMetafields.push(...inputs);
  }

  if (DRY_RUN || !allMetafields.length) return;

  const chunkSize = 25;
  for (let i = 0; i < allMetafields.length; i += chunkSize) {
    const chunk = allMetafields.slice(i, i + chunkSize);
    const setData = await gql(
      `
      mutation SetSpecsMetafields($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key }
          userErrors { field message }
        }
      }
    `,
      { metafields: chunk },
    );
    const result = setData.metafieldsSet;
    if (result.userErrors?.length) {
      throw new Error(result.userErrors.map((e) => e.message).join('; '));
    }
    console.log(`Set ${result.metafields.length} metafields (batch ${i / chunkSize + 1}).`);
  }
}

async function main() {
  const rows = buildMigrationRows();
  console.log(DRY_RUN ? 'Dry run — no Admin writes.' : 'Syncing product specs metafields to Admin…');
  console.log(`Products from templates: ${rows.map((r) => r.handle).join(', ')}`);
  await ensureDefinitions();
  await syncProducts(rows);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
