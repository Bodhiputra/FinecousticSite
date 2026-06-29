#!/usr/bin/env bash
# Shopify theme repo preflight — runs only from shopify/.cursor/hooks.json (not Deku).
set -euo pipefail

input="$(cat)"

python3 -c "
import json
import re
import sys

raw = sys.stdin.read()
try:
    data = json.loads(raw) if raw.strip() else {}
except json.JSONDecodeError:
    data = {}

hook_event = data.get('hook_event_name', '')

def pick_str(*keys):
    for key in keys:
        val = data.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ''

prompt = pick_str('prompt', 'user_message', 'text', 'message')
file_path = pick_str('file_path', 'filePath', 'path', 'file', 'target_file', 'targetFile')

args = data.get('arguments') or data.get('args') or data.get('input') or data.get('tool_input') or {}
if isinstance(args, str):
    try:
        args = json.loads(args)
    except json.JSONDecodeError:
        args = {}
if not isinstance(args, dict):
    args = {}

if not file_path:
    for key in ('path', 'file_path', 'filePath', 'target_file', 'targetFile'):
        val = args.get(key)
        if isinstance(val, str) and val.strip():
            file_path = val.strip()
            break

PROMPT_RE = re.compile(r'(?i)\bshopify\b')

def norm(path):
    return path.replace('\\\\', '/')

def is_theme_file(path):
    if not path:
        return False
    p = norm(path)
    if re.search(r'(^|/)shopify/(sections|snippets|layout|templates|assets|config)/', p):
        return True
    if re.search(r'^\.?/?(sections|snippets|layout|templates|assets|config)/', p):
        return True
    if re.search(r'/(sections|snippets|layout|templates|assets|config)/', p):
        return True
    return bool(re.search(r'\.liquid\$|theme\.liquid|custom-style\.css', p, re.I))

def should_fire():
    if prompt and PROMPT_RE.search(prompt):
        return True
    return bool(file_path and is_theme_file(file_path))

if not should_fire():
    print(json.dumps({'permission': 'allow'}) if hook_event == 'preToolUse' else '{}')
    sys.exit(0)

msg = '''SHOPIFY THEME PREFLIGHT (hook) — this chat is for the shopify theme repo (separate from finecoustic/Deku).

SKIP Deku bootstrap unless the user explicitly asks for brand/KOL/ops context:
- Do NOT read finecoustic/.claude/BOOTSTRAP.md, context/brand-context.md, or context/session-context.md first.

READ (this repo — paths relative to shopify theme root):
1. .cursor/skills/shopify-theme/SKILL.md
2. CLAUDE.md — safety, CSS placement, store j5gawi-vu.myshopify.com
3. context/shopify-context.md and context/codebase-summary.md when present
4. Task skill(s) from .cursor/skills/:
   - Liquid / sections / snippets / schemas → shopify-liquid
   - theme dev / check / push / CLI → shopify-use-shopify-cli
   - metafields / metaobjects → shopify-custom-data
   - API / docs lookup → shopify-dev
5. Non-trivial Liquid/schema: run shopify-liquid validate scripts from that skill dir

FIRST REPLY MUST announce which Shopify skills/files you loaded, then continue (git status, task work, etc.).

Hard rules: no Admin mutations or live publish without approval; no git commit; CSS → custom-style.css / {% stylesheet %}; never edit config/settings_schema.json unless asked.'''

out = {'agent_message': msg}
if hook_event == 'preToolUse':
    out['permission'] = 'allow'
print(json.dumps(out))
" <<< "$input"
