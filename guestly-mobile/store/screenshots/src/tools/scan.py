#!/usr/bin/env python3
"""Panel 08: put a real guest pass in front of the door scanner's camera.

  python3 tools/scan.py <raw-dir>

The simulator has no camera, so the captured check-in screen shows the app's
UI over a black field. This builds what the camera would see (a printed guest
pass, rendered from the portal's real /pass page for that demo guest, held up
with a slight tilt in a softly lit, out-of-focus venue), puts it under the
app's own 35 % scrim (checkin.tsx), and lays the captured UI back on top with a
lighten blend (every UI element is lighter than the black field it was drawn
on, so the UI survives untouched and the camera shows only where the app's
background was). No app UI is drawn here.

Inputs : raw/c-{en,es}-checkin.png (captures), assets/pass/pass-{en,es}.png
         (the pass card, screenshotted from app.guest-ly.com/pass/demo-review),
         assets/photos/courtyard-night.jpg (backdrop, blurred).
Output : raw/c-{en,es}-checkin-scan.png
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "raw")
W, H = 1320, 2868
FRAME = (240, 515, 1080, 1355)            # the gold scan frame in the capture
QR_IN_CARD = (596, 1199, 623)             # centre x, centre y, size in pass px
CARD_CROP = 1772                          # keep the pass down to its door line (drop the Print button)


def coeffs(src, dst):
    """PIL PERSPECTIVE coefficients mapping output (dst) points back to input (src)."""
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


def printed_card(path):
    card = Image.open(path).convert("RGB")
    card = card.crop((0, 0, card.width, CARD_CROP))
    w, h = card.size
    # the page's translucent card sits on a dark aurora; as printed stock it is opaque
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=72, fill=255)
    # soft light across the stock: brighter top left, falling off to the lower right
    yy, xx = np.mgrid[0:h, 0:w]
    light = 1.0 + 0.16 * (1 - (xx / w * 0.5 + yy / h * 0.8))
    arr = np.clip(np.asarray(card, float) * light[..., None] + 6, 0, 255).astype(np.uint8)
    card = Image.fromarray(arr)
    rgba = card.convert("RGBA"); rgba.putalpha(m)
    return rgba


def camera(card_path):
    # out-of-focus venue behind the pass
    bg = Image.open(os.path.join(HERE, "assets", "photos", "courtyard-night.jpg")).convert("RGB")
    s = H / bg.height * 1.25
    bg = bg.resize((int(bg.width * s), int(bg.height * s)), Image.LANCZOS)
    left = int(bg.width * 0.36)
    bg = bg.crop((left, int(bg.height * 0.1), left + W, int(bg.height * 0.1) + H)).filter(ImageFilter.GaussianBlur(38))
    bg = Image.fromarray((np.asarray(bg, float) * 0.8).astype(np.uint8))

    card = printed_card(card_path)
    cw, ch = card.size
    k = 0.6                                          # whole pass in view: QR ~390 px, inside the 840 px frame
    fcx, fcy = (FRAME[0] + FRAME[2]) / 2, (FRAME[1] + FRAME[3]) / 2 + 10
    # card centred left-right, its top just under the top bar; the QR lands in the frame
    x0 = fcx - cw * k / 2; y0 = 360
    w, h = cw * k, ch * k
    # slight keystone (top edge a little farther away) and a small roll
    ang = np.radians(-4.0)
    pts = [(x0 + 18, y0 + 10), (x0 + w - 14, y0 - 6), (x0 + w + 10, y0 + h + 4), (x0 - 12, y0 + h - 8)]
    ca, sa = np.cos(ang), np.sin(ang)
    pts = [(fcx + (x - fcx) * ca - (y - fcy) * sa, fcy + (x - fcx) * sa + (y - fcy) * ca) for x, y in pts]
    warped = card.transform((W, H), Image.PERSPECTIVE, coeffs([(0, 0), (cw, 0), (cw, ch), (0, ch)], pts), Image.BICUBIC)

    # contact shadow under the card, then the card itself, a hair soft like a real lens
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).polygon([(x + 16, y + 30) for x, y in pts], fill=170)
    sh = sh.filter(ImageFilter.GaussianBlur(40))
    base = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), bg, sh)
    warped = warped.filter(ImageFilter.GaussianBlur(0.8))
    base.paste(warped, (0, 0), warped)
    arr = np.asarray(base, float)
    # sensor noise and a gentle vignette so it reads as a camera feed
    rng = np.random.default_rng(7)
    arr += rng.normal(0, 4.0, arr.shape)
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / (W * 0.8)) ** 2 + ((yy - 900) / (H * 0.6)) ** 2)
    arr *= np.clip(1.08 - 0.55 * d ** 2, 0.25, 1.08)[..., None]
    # the app's scrim over the camera: rgba(8,11,16,0.35)
    arr = arr * 0.65 + np.array([8, 11, 16]) * 0.35
    return np.clip(arr, 0, 255)


for lang in ("en", "es"):
    ui = np.asarray(Image.open(os.path.join(RAW, f"c-{lang}-checkin.png")).convert("RGB"), float)
    cam = camera(os.path.join(HERE, "assets", "pass", f"pass-{lang}.png"))
    out = np.maximum(ui, cam)  # lighten: UI over camera
    Image.fromarray(out.astype(np.uint8)).save(os.path.join(RAW, f"c-{lang}-checkin-scan.png"))
    print(lang, "->", f"c-{lang}-checkin-scan.png")
