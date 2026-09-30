#!/usr/bin/env python3
"""Copy the raw simulator captures the panels use into assets/, and cut the
lifted callouts from those same captures.

  python3 tools/prepare.py <raw-dir>

<raw-dir> holds native 1320x2868 PNGs from the iPhone 17 Pro Max simulator
(names as in SCREENS / CROPS below). Screens are stored as high quality JPEG
(sRGB, no alpha) to keep the repo light; callouts stay PNG.

A crop with "tight": true is snapped to the card edge: inside the rough box,
a pixel counts as card when it is brighter than the background just outside
the box on that row; rows and columns that are mostly card give the bounds.
"""
import json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "raw")
spec = json.load(open(os.path.join(HERE, "crops.json")))

def lum(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

def tighten(im, box, thr=5, dens=0.3):
    x0, y0, x1, y1 = box
    px = im.load()
    rows, cols = [], [0] * (x1 - x0)
    for y in range(y0, y1):
        bg = min(lum(px[max(x0 - 6, 0), y]), lum(px[min(x1 + 6, im.width - 1), y]))
        n = 0
        for i, x in enumerate(range(x0, x1)):
            if lum(px[x, y]) > bg + thr:
                n += 1
                cols[i] += 1
        rows.append(n / (x1 - x0))
    ys = [y0 + i for i, r in enumerate(rows) if r > dens]
    h = y1 - y0
    xs = [x0 + i for i, c in enumerate(cols) if c / h > dens * 0.6]
    return (xs[0], ys[0], xs[-1] + 1, ys[-1] + 1)

for lang in ("en", "es"):
    os.makedirs(os.path.join(HERE, "assets", "screens", lang), exist_ok=True)
    os.makedirs(os.path.join(HERE, "assets", "callouts", lang), exist_ok=True)
    for key, name in spec["screens"][lang].items():
        im = Image.open(os.path.join(RAW, name + ".png")).convert("RGB")
        assert im.size == (1320, 2868), (name, im.size)
        im.save(os.path.join(HERE, "assets", "screens", lang, key + ".jpg"), quality=94, subsampling=0)
    out = {}
    for key, c in spec["crops"][lang].items():
        im = Image.open(os.path.join(RAW, c["src"] + ".png")).convert("RGB")
        box = tuple(c["box"])
        if c.get("tight"):
            box = tighten(im, box)
            if c.get("extend_top"):
                box = (box[0], box[1] - c["extend_top"], box[2], box[3])
        im.crop(box).save(os.path.join(HERE, "assets", "callouts", lang, key + ".png"))
        out[key] = {"box": box, "w": box[2] - box[0], "h": box[3] - box[1]}
    json.dump(out, open(os.path.join(HERE, "assets", "callouts", lang, "boxes.json"), "w"), indent=1)
    print(lang, json.dumps(out))

# boxes.js: the same numbers for the page (file:// pages cannot fetch JSON).
allb = {lang: json.load(open(os.path.join(HERE, "assets", "callouts", lang, "boxes.json"))) for lang in ("en", "es")}
open(os.path.join(HERE, "boxes.js"), "w").write("window.BOXES = " + json.dumps(allb) + ";\n")
