#!/usr/bin/env python3
"""Push listed theme asset keys to live theme via Admin API."""
import json
import subprocess
import pathlib
import tempfile
import os
import base64
import sys

THEME_ID = "143866527818"
STORE = "j5gawi-vu.myshopify.com"
API = f"https://{STORE}/admin/api/2024-10/themes/{THEME_ID}/assets.json"
ROOT = pathlib.Path(__file__).resolve().parents[1]
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ico", ".svg"}


def get_token():
    env = ROOT / ".env"
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("SHOPIFY_ADMIN_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("SHOPIFY_ADMIN_TOKEN not found in .env")


def upload(key: str, token: str) -> None:
    path = ROOT / key
    if not path.is_file():
        raise FileNotFoundError(key)
    payload = {"asset": {"key": key}}
    if path.suffix.lower() in BINARY_EXT:
        payload["asset"]["attachment"] = base64.b64encode(path.read_bytes()).decode("ascii")
    else:
        payload["asset"]["value"] = path.read_text(encoding="utf-8")

    fd, tmp = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f)
        res = subprocess.run(
            [
                "curl",
                "-sS",
                "--max-time",
                "120",
                "-X",
                "PUT",
                "-H",
                f"X-Shopify-Access-Token: {token}",
                "-H",
                "Content-Type: application/json",
                API,
                "--data-binary",
                f"@{tmp}",
            ],
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            raise RuntimeError(res.stderr.strip() or "curl error")
        data = json.loads(res.stdout)
        if "errors" in data or "asset" not in data:
            raise RuntimeError(str(data.get("errors", data)))
    finally:
        os.unlink(tmp)


def main():
    token = get_token()
    keys = [line.strip() for line in sys.stdin if line.strip()]
    ok = 0
    for key in keys:
        upload(key, token)
        ok += 1
        print(f"  ✓ {key}", flush=True)
    print(f"\nDone: {ok}/{len(keys)} uploaded", flush=True)


if __name__ == "__main__":
    main()
