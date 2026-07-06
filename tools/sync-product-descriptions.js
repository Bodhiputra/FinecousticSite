#!/usr/bin/env node
/**
 * Sync product Description in Shopify Admin (source of truth for PDP).
 * Updates descriptionHtml via Admin API — theme reads product.description only.
 *
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 * Usage: node tools/sync-product-descriptions.js [--dry-run]
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

/** Canonical paragraph copy — must match what PDP should show. */
const DESCRIPTION_BY_HANDLE = {
  'groove-anc-ft20':
    'Powerful 13 mm drivers deliver deep bass and clear highs, while Active Noise Cancellation keeps distractions out. ENC technology ensures crisp calls, Bluetooth 5.3 provides stable wireless connection, and all-day battery life keeps you going without interruptions.',
  'groove-ows-ft21':
    'Lightweight open-ear design with a secure fit for all-day comfort and awareness of your surroundings. A 16 mm dynamic driver delivers deep, energizing bass, while AI-enhanced noise reduction keeps calls clear and natural. Up to 45 hours of battery life, stable low-latency wireless connection, and targeted audio design for reduced sound leakage complete the experience.',
  'resono-wfm1':
    'Cardioid pickup captures natural, studio-quality voice clarity, while the built-in shock mount minimizes unwanted vibrations and table noise. Monitor Mix Control lets you balance voice and system audio directly from the microphone, complete with a detachable full-metal pop filter and instant mute / ENC controls for seamless recording and streaming.',
  'sonara-ufm1':
    "Switch effortlessly between Cardioid, Omnidirectional, and Bidirectional modes for vocals, interviews, or group calls. Portable and versatile, it's built for mobile streaming, video calls, or studio recording. Built-in monitor and gain controls let you shape audio in real time, while the integrated shock mount reduces vibrations. Comes with a detachable full-metal pop filter and instant touch controls for ENC and mute, ensuring clear, professional sound anytime.",
  'hako-nomad-fbs1':
    'Small but loud retro-aesthetic box speaker designed to bring presence into everyday sound. Its ambient lighting adds subtle atmosphere to any space, while flexible connectivity options—Bluetooth, AUX, USB, and TF card—keep it adaptable to different listening needs. Built-in EQ allows quick sound adjustment to match mood or environment, and an integrated microphone enables clear calls and voice use directly through the device. With TWS pairing, two units can connect to create a wider stereo experience, extending its sound beyond its compact form.',
  'hako-nomad-l-fbs2':
    'Larger retro-aesthetic designed box speaker. With increased output power and a dedicated 2-tweeter and 1-woofer setup. Everything else stays the same as the smaller Hako Nomad',
};

function toDescriptionHtml(text) {
  return `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
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

async function syncDescriptions() {
  for (const [handle, text] of Object.entries(DESCRIPTION_BY_HANDLE)) {
    const html = toDescriptionHtml(text);
    const lookup = await gql(
      `query ($query: String!) { products(first: 1, query: $query) { nodes { id handle title descriptionHtml } } }`,
      { query: `handle:${handle}` }
    );
    const product = lookup.products.nodes[0];
    if (!product) {
      console.warn(`Product not found: ${handle}`);
      continue;
    }
    if (product.descriptionHtml === html) {
      console.log(`${handle}: already up to date`);
      continue;
    }
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${handle}`);
    if (DRY_RUN) continue;
    const result = await gql(
      `mutation ($input: ProductInput!) {
        productUpdate(input: $input) {
          product { handle descriptionHtml }
          userErrors { field message }
        }
      }`,
      { input: { id: product.id, descriptionHtml: html } }
    );
    const errors = result.productUpdate.userErrors;
    if (errors?.length) {
      throw new Error(`${handle}: ${errors.map((e) => e.message).join('; ')}`);
    }
    console.log(`  updated Admin description`);
  }
}

async function main() {
  console.log(DRY_RUN ? 'Dry run — no Admin writes.' : 'Syncing product descriptions to Admin…');
  await syncDescriptions();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
