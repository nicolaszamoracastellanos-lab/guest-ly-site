#!/usr/bin/env python3
"""Contact sheets for review.  python3 tools/sheets.py <out-dir> [set]   (set defaults to v3)
sheet-en.png / sheet-es.png : all panels at 440 px wide (one third scale)
sheet-search-en.png / -es   : all panels at App Store search-result size (300 px wide)
sheet-search-trio.png       : panels 1-3, EN over ES, 300 px wide, as in search results
"""
import glob, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
SET = sys.argv[2] if len(sys.argv) > 2 else "v3"
os.makedirs(OUT, exist_ok=True)
DIRS = {"en": "en-US", "es": "es-MX"}

def panels(lang):
    return sorted(glob.glob(os.path.join(HERE, "..", "ios-6.9", DIRS[lang], SET, "*.png")))

def row(files, w, gap, bg, pad=40):
    ims = [Image.open(f).convert("RGB") for f in files]
    h = round(ims[0].height * w / ims[0].width)
    ims = [i.resize((w, h), Image.LANCZOS) for i in ims]
    W = pad * 2 + len(ims) * w + (len(ims) - 1) * gap
    s = Image.new("RGB", (W, h + pad * 2), bg)
    for k, i in enumerate(ims):
        m = Image.new("L", i.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(8, w // 22), fill=255)
        s.paste(i, (pad + k * (w + gap), pad), m)
    return s

for lang in ("en", "es"):
    row(panels(lang), 440, 24, (242, 240, 236)).save(os.path.join(OUT, f"sheet-{lang}.png"))
    row(panels(lang), 300, 14, (255, 255, 255)).save(os.path.join(OUT, f"sheet-search-{lang}.png"))
a = row(panels("en")[:3], 300, 14, (255, 255, 255)); b = row(panels("es")[:3], 300, 14, (255, 255, 255))
t = Image.new("RGB", (a.width, a.height + b.height), (255, 255, 255)); t.paste(a, (0, 0)); t.paste(b, (0, a.height))
t.save(os.path.join(OUT, "sheet-search-trio.png"))
print("sheets ->", OUT)
