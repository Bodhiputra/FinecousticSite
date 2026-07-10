#!/usr/bin/env node
/**
 * Update Finecoustic shipping policy in Shopify Admin (Settings → Policies).
 * Requires shopify/.env: SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

const SHIPPING_POLICY_BODY = `<h2>1. Where We Ship</h2>
<p>We currently ship to the following countries:</p>
<p><strong>Asia:</strong> Bahrain, Brunei, India, Israel, Japan, Jordan, Kuwait, Malaysia, Philippines, Qatar, Saudi Arabia, Singapore, South Korea, Thailand, United Arab Emirates (UAE), Vietnam</p>
<p><strong>Oceania:</strong> Australia, New Zealand</p>
<p><strong>North America:</strong> Canada, Mexico, United States</p>
<p><strong>South America:</strong> Chile, Colombia, Peru</p>
<p><strong>Europe:</strong> Austria, Belgium, Bulgaria, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, T&uuml;rkiye, Ukraine, United Kingdom</p>
<p><strong>Africa:</strong> South Africa</p>
<p>Don&rsquo;t see your country listed? Check our <a href="/pages/store-locator">Store Locator</a> for authorized retailers near you, or reach out through our <a href="/pages/support?tab=contact">Contact page</a> &mdash; we&rsquo;ll do our best to advise if delivery is possible.</p>
<h2>2. Shipping Carrier</h2>
<p>We partner with <strong>Yanwen Express</strong> for international logistics. Final delivery is handled by local carriers (e.g. USPS, FedEx, or your country&rsquo;s postal service). Additional shipping options may be added in the future.</p>
<h2>3. Shipping Times</h2>
<p>Delivery estimates are in business days and do not include customs clearance delays. Actual delivery times may vary depending on your location and local courier conditions.</p>
<h3>Asia</h3>
<ul>
<li><strong>4&ndash;9 business days:</strong> Japan, Vietnam</li>
<li><strong>5&ndash;11 business days:</strong> Thailand</li>
<li><strong>7&ndash;14 business days:</strong> Singapore, South Korea</li>
<li><strong>11&ndash;15 business days:</strong> Malaysia, Philippines, India</li>
<li><strong>8&ndash;16 business days:</strong> United Arab Emirates (UAE), Israel, Saudi Arabia, Kuwait</li>
<li><strong>8&ndash;13 business days:</strong> Bahrain</li>
<li><strong>10&ndash;16 business days:</strong> Brunei, Qatar, Jordan</li>
</ul>
<h3>Oceania</h3>
<ul><li><strong>8&ndash;17 business days:</strong> Australia, New Zealand</li></ul>
<h3>North America</h3>
<ul>
<li><strong>8&ndash;15 business days:</strong> United States</li>
<li><strong>10&ndash;15 business days:</strong> Canada</li>
<li><strong>15&ndash;32 business days:</strong> Mexico</li>
</ul>
<h3>South America</h3>
<ul>
<li><strong>12&ndash;20 business days:</strong> Chile</li>
<li><strong>15&ndash;32 business days:</strong> Colombia</li>
<li><strong>20&ndash;40 business days:</strong> Peru</li>
</ul>
<h3>Europe</h3>
<ul>
<li><strong>5&ndash;13 business days:</strong> United Kingdom, Germany</li>
<li><strong>7&ndash;12 business days:</strong> Spain, Poland</li>
<li><strong>8&ndash;13 business days:</strong> France, Portugal</li>
<li><strong>9&ndash;11 business days:</strong> Austria</li>
<li><strong>10&ndash;12 business days:</strong> Italy, Netherlands, Belgium, Luxembourg, Switzerland</li>
<li><strong>7&ndash;16 business days:</strong> Bulgaria, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland, Greece, Hungary, Ireland, Latvia, Lithuania, Malta, Norway, Romania, Serbia, Slovakia, Slovenia, Sweden, T&uuml;rkiye, Ukraine</li>
</ul>
<h3>Africa</h3>
<ul><li><strong>15&ndash;32 business days:</strong> South Africa</li></ul>
<p><strong>Please note:</strong> Shipping times are estimates only. Delays may occur due to customs inspections, public holidays, weather conditions, or local courier operations.</p>
<h2>4. Order Processing</h2>
<p>Orders are processed within <strong>2&ndash;4 business days</strong> after payment has been confirmed.</p>
<p>For updates on fulfillment or delivery delays, refer to our official announcements on our website and social media channels.</p>
<h2>5. Order Cancellation</h2>
<p>Cancellations must be requested <strong>within 12 hours of purchase</strong> and are only possible before the order has been shipped.</p>
<p>To request a cancellation, submit a request through our <a href="/pages/support?tab=support">Support page</a> with your order number.</p>
<p>Once the order has been shipped, cancellation is no longer possible. Any returns following shipment will be the customer&rsquo;s responsibility in accordance with our <a href="/pages/policies?policy=refund-policy">Return &amp; Refund Policy</a>.</p>
<h2>6. Shipping Costs</h2>
<p>Shipping fees are calculated automatically at checkout based on the weight and dimensions of your order.</p>
<h2>7. Shipping Restrictions</h2>
<p>We do not ship to:</p>
<ul>
<li>PO Boxes, APO/DPO addresses, or Amazon FBA warehouses</li>
<li>Forwarding addresses or remote islands</li>
</ul>
<h2>8. Customer Responsibilities</h2>
<p>To ensure smooth delivery:</p>
<ul>
<li>Provide accurate details &mdash; full legal name, complete address, and valid contact information. Incorrect information may result in return or reshipping fees.</li>
<li>Monitor your tracking and respond promptly to any customs requests (such as duties or taxes) within 48 hours to avoid surcharges or return of the package.</li>
<li>If your shipment appears stuck or delayed, reach out through our <a href="/pages/support?tab=support">Support page</a> as soon as possible.</li>
</ul>
<p>Reshipping costs due to customer-provided errors are the customer&rsquo;s responsibility.</p>
<h2>9. Track Your Order</h2>
<p>Once your order has been dispatched, you will receive a tracking number by email. Use it on our <a href="/pages/support?tab=track">Track Order</a> page to monitor your shipment in real time.</p>`;

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

async function main() {
  const result = await gql(
    `mutation ($shopPolicy: ShopPolicyInput!) {
      shopPolicyUpdate(shopPolicy: $shopPolicy) {
        shopPolicy { type title }
        userErrors { field message }
      }
    }`,
    {
      shopPolicy: {
        type: 'SHIPPING_POLICY',
        body: SHIPPING_POLICY_BODY,
      },
    }
  );

  const errors = result.shopPolicyUpdate.userErrors;
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '));
  console.log('Updated shipping policy in Shopify Admin.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
