#!/usr/bin/env python3
"""
Upload product images to Shopify using the REST API with multipart/form-data
approach via staged uploads (GraphQL stagedUploadsCreate → PUT → productCreateMedia).
Falls back to base64 with chunked reading.

Requires shopify/.env with SHOPIFY_ADMIN_TOKEN and SHOPIFY_STORE.
"""
import base64, json, urllib.request, urllib.error, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
ENV_PATH = os.path.join(REPO_ROOT, ".env")


def load_env(path):
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ.setdefault(key, value)


load_env(ENV_PATH)

TOKEN = os.environ.get("SHOPIFY_ADMIN_TOKEN")
STORE = os.environ.get("SHOPIFY_STORE")
API_VERSION = os.environ.get("SHOPIFY_API_VERSION", "2024-10")

if not TOKEN or not STORE:
    print("Missing credentials.", file=sys.stderr)
    print(f"Create {ENV_PATH} with SHOPIFY_ADMIN_TOKEN and SHOPIFY_STORE.", file=sys.stderr)
    sys.exit(1)

API = f"https://{STORE}/admin/api/{API_VERSION}"

HEADERS = {
    "X-Shopify-Access-Token": TOKEN,
    "Content-Type": "application/json",
}

def gql(query, variables=None):
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        f"https://{STORE}/admin/api/{API_VERSION}/graphql.json",
        data=payload, method="POST", headers=HEADERS
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def stage_and_upload(img_path):
    filename = os.path.basename(img_path)
    filesize = os.path.getsize(img_path)
    mime = "image/png" if filename.lower().endswith(".png") else "image/jpeg"

    # Step 1: create staged upload target
    result = gql("""
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters { name value }
            }
            userErrors { field message }
          }
        }
    """, {"input": [{"filename": filename, "mimeType": mime, "resource": "IMAGE", "fileSize": str(filesize), "httpMethod": "POST"}]})

    targets = result["data"]["stagedUploadsCreate"]["stagedTargets"]
    if not targets:
        print(f"✗ Stage failed for {filename}: {result}")
        return None

    target = targets[0]
    staged_url = target["url"]
    resource_url = target["resourceUrl"]
    params = {p["name"]: p["value"] for p in target["parameters"]}

    # Step 2: POST to staged URL using multipart
    import io
    boundary = "------ShopifyBoundary"
    body = io.BytesIO()
    for k, v in params.items():
        body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    with open(img_path, "rb") as f:
        img_data = f.read()
    body.write(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n".encode())
    body.write(img_data)
    body.write(f"\r\n--{boundary}--\r\n".encode())
    body_bytes = body.getvalue()

    req2 = urllib.request.Request(staged_url, data=body_bytes, method="POST", headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}"
    })
    try:
        with urllib.request.urlopen(req2, timeout=60) as r:
            r.read()
        print(f"  ↑ Staged upload OK: {filename}")
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ✗ Staged upload failed: {err}")
        return None

    return resource_url

def attach_image_to_product(product_id, resource_url, filename):
    result = gql("""
        mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            media { ... on MediaImage { image { url } } }
            mediaUserErrors { field message }
          }
        }
    """, {
        "productId": f"gid://shopify/Product/{product_id}",
        "media": [{"originalSource": resource_url, "mediaContentType": "IMAGE", "alt": filename}]
    })
    errors = result["data"]["productCreateMedia"]["mediaUserErrors"]
    if errors:
        print(f"  ✗ Attach failed: {errors}")
    else:
        media = result["data"]["productCreateMedia"]["media"]
        if media and media[0] and media[0].get("image"):
            print(f"  ✓ Attached: {media[0]['image']['url']}")
        else:
            print(f"  ✓ Queued for processing (no immediate URL)")

uploads = [
    {
        "product_id": "8140779520074",
        "label": "HAKO NOMAD FBS1",
        "images": [
            "/Users/fantech/Desktop/Finecoustic-Bodhi/TBT_FBS1_2 2/TBT_FBS1_2.png",
            "/Users/fantech/Desktop/Finecoustic-Bodhi/TBT_FBS1_2 2/TBT_FBS1_8.png",
        ]
    },
    {
        "product_id": "8140779552842",
        "label": "HAKO NOMAD L FBS2",
        "images": [
            "/Users/fantech/Desktop/Finecoustic-Bodhi/PNG_FBS2/FBS2_TBT_front.png",
            "/Users/fantech/Desktop/Finecoustic-Bodhi/PNG_FBS2/FBS2_TBT_3.png",
        ]
    },
]

for product in uploads:
    print(f"\n── {product['label']} ──")
    for img_path in product["images"]:
        filename = os.path.basename(img_path)
        print(f"  Uploading {filename}...")
        resource_url = stage_and_upload(img_path)
        if resource_url:
            attach_image_to_product(product["product_id"], resource_url, filename)
