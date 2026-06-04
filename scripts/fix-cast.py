#!/usr/bin/env python3
"""
Converts a raw asciinema cast (v2 or v3, possibly with shell noise) into a
clean v2 cast containing only the tailorcv demo output.

Usage: python3 scripts/fix-cast.py docs/demo.cast
"""
import re, json, sys

path = sys.argv[1] if len(sys.argv) > 1 else 'docs/demo.cast'

with open(path, 'rb') as f:
    raw = f.read().decode('latin-1')

# ── extract header ────────────────────────────────────────────────────────────
header_raw = json.loads(re.match(r'(\{[^\n]+\})', raw).group(1))
if header_raw.get('version') == 3:
    width  = header_raw['term']['cols']
    height = header_raw['term']['rows']
else:
    width  = header_raw['width']
    height = header_raw['height']

header = {'version': 2, 'width': width, 'height': height}

# ── stream-extract all valid events ──────────────────────────────────────────
EVENT_START = re.compile(r'\[(\d+\.\d+), "([io])", "')
events = []
pos = 0
while True:
    m = EVENT_START.search(raw, pos)
    if not m:
        break
    start = m.start()
    next_m = EVENT_START.search(raw, start + 1)
    end_limit = next_m.start() if next_m else len(raw)
    candidate = raw[start:end_limit].rstrip()
    parsed = None
    for end in range(min(len(candidate), end_limit - start), 0, -1):
        if candidate[end-1] == ']':
            try:
                obj = json.loads(candidate[:end])
                if isinstance(obj, list) and len(obj) == 3:
                    parsed = obj
                    pos = start + end
                    break
            except:
                continue
    if parsed is None:
        pos = start + 1
        continue
    events.append(parsed)

# ── find where tailorcv demo output starts ────────────────────────────────────
start_idx = 0
for i, ev in enumerate(events):
    clean = re.sub(r'\x1b\[[^a-zA-Z]*[a-zA-Z]', '', ev[2])
    if 'TailorCV' in clean or 'Generate a tailored' in clean:
        start_idx = i
        break

# Re-zero timestamps from that point
t0 = events[start_idx][0]
trimmed = [[round(ev[0] - t0, 3), ev[1], ev[2]] for ev in events[start_idx:]]

out = json.dumps(header) + '\n' + '\n'.join(json.dumps(e, ensure_ascii=True) for e in trimmed) + '\n'
with open(path, 'w', encoding='utf-8') as f:
    f.write(out)

print(f'Done: {len(trimmed)} events, width={width}, height={height}')
print(f'Skipped {start_idx} shell-noise events before TailorCV output')
