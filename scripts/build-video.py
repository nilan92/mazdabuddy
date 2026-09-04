#!/usr/bin/env python3
"""Builds a cinematic AutoPulse demo video using Pillow + ffmpeg."""

import os, subprocess, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT   = Path(__file__).parent.parent
W_DIR  = ROOT / "walkthrough"
TMP    = W_DIR / "frames"
OUT    = W_DIR / "autopulse-demo.mp4"
ICON   = ROOT / "public" / "android-chrome-512x512.png"

TMP.mkdir(exist_ok=True)

W, H       = 2560, 1600           # source screenshot size
CW, CH     = 2560, 1071           # 2.39:1 crop
BAR        = (H - CH) // 2        # 264 px black bars
FPS        = 30
XFADE      = 0.6                  # seconds overlap between scenes
CYAN       = (6, 182, 212)
WHITE      = (255, 255, 255)
GREY       = (180, 180, 190)
BLACK      = (0, 0, 0)

# ── fonts ─────────────────────────────────────────────────────────────────────
def load_font(paths, size):
    for p in paths:
        if Path(p).exists():
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()

BOLD_PATHS = [
    "/System/Library/Fonts/Supplemental/Impact.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]
BODY_PATHS = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]

F_TITLE    = load_font(BOLD_PATHS, 72)
F_SUB      = load_font(BODY_PATHS, 34)
F_INTRO_BIG= load_font(BOLD_PATHS, 130)
F_INTRO_SUB= load_font(BODY_PATHS, 44)

# ── scenes ────────────────────────────────────────────────────────────────────
# (source_png, section_title, subtitle, duration_sec)
SCENES = [
    ("intro",            "AutoPulse",    "Workshop Management System",   3.5),
    ("01-landing.png",   "AutoPulse",    "Cloud-based workshop platform",4.0),
    ("02-login.png",     "Secure Access","Role-based authentication",    3.5),
    ("04-dashboard.png", "Dashboard",    "Real-time workshop overview",  4.5),
    ("06-jobs-kanban.png","Job Board",   "Kanban workflow management",   4.5),
    ("07-job-card-open.png","Job Details","Parts, labor & AI diagnostics",4.5),
    ("08-customers.png", "Customers",    "Client & vehicle records",     4.0),
    ("09-inventory.png", "Inventory",    "Parts stock & pricing",        4.0),
    ("10-invoices.png",  "Invoicing",    "Auto-generated on completion", 4.0),
    ("12-settings.png",  "Settings",     "Per-tenant configuration",     4.0),
    ("outro",            "AutoPulse",    "Get started today",            3.5),
]

def make_letterbox(img):
    """Crop to 2.39:1 and pad back to original H with black bars."""
    cropped = img.crop((0, BAR, W, BAR + CH))
    canvas  = Image.new("RGB", (W, H), BLACK)
    canvas.paste(cropped, (0, BAR))
    return canvas

def color_grade(img):
    """Boost contrast, slight cool tint."""
    from PIL import ImageEnhance, ImageFilter
    img = ImageEnhance.Contrast(img).enhance(1.12)
    img = ImageEnhance.Color(img).enhance(1.15)
    r, g, b = img.split()
    r = r.point(lambda x: int(x * 0.96))
    b = b.point(lambda x: min(255, int(x * 1.07)))
    return Image.merge("RGB", (r, g, b))

def draw_lower_third(img, title, subtitle):
    d   = ImageDraw.Draw(img)
    ty  = int(H * 0.73)          # title Y — inside the crop zone
    sy  = ty + 82
    bx  = 90
    # cyan accent bar
    d.rectangle([bx, ty - 10, bx + 7, ty + 62], fill=CYAN)
    # title shadow
    d.text((bx + 22 + 2, ty + 2), title, font=F_TITLE, fill=(0,0,0,160))
    d.text((bx + 22, ty), title, font=F_TITLE, fill=WHITE)
    # subtitle
    d.text((bx + 22, sy), subtitle, font=F_SUB, fill=GREY)
    return img

def make_intro_card():
    img  = Image.new("RGB", (W, H), (4, 10, 24))   # very dark navy
    d    = ImageDraw.Draw(img)
    # subtle grid lines
    for x in range(0, W, 160):
        d.line([(x, 0), (x, H)], fill=(20, 30, 50), width=1)
    for y in range(0, H, 160):
        d.line([(0, y), (W, y)], fill=(20, 30, 50), width=1)
    # glow blob behind logo
    for r in range(340, 0, -4):
        alpha = int(40 * (1 - r/340))
        d.ellipse([(W//2 - r, H//2 - 300 - r), (W//2 + r, H//2 - 300 + r)],
                  fill=(6, 182, 212, alpha))
    # app icon
    if ICON.exists():
        icon = Image.open(ICON).convert("RGBA").resize((200, 200), Image.LANCZOS)
        img.paste(icon, (W//2 - 100, H//2 - 400), icon)
    # brand name
    cx = W // 2
    d.text((cx + 2, H//2 - 162 + 2), "AUTOPULSE", font=F_INTRO_BIG,
           fill=(0,0,0,200), anchor="mt")
    d.text((cx, H//2 - 162), "AUTOPULSE", font=F_INTRO_BIG,
           fill=WHITE, anchor="mt")
    # cyan underline
    tw = d.textlength("AUTOPULSE", font=F_INTRO_BIG)
    d.rectangle([cx - tw//2, H//2 - 10, cx - tw//2 + int(tw * 0.28), H//2 - 4],
                fill=CYAN)
    # tagline
    d.text((cx, H//2 + 50), "Workshop Management System", font=F_INTRO_SUB,
           fill=GREY, anchor="mt")
    return make_letterbox(img)

def make_outro_card():
    img = make_intro_card()
    d   = ImageDraw.Draw(img)
    # overwrite tagline
    d.rectangle([0, H//2 + 40, W, H//2 + 130], fill=(4, 10, 24))
    d.text((W//2, H//2 + 50), "nilan92.github.io/mazdabuddy",
           font=F_INTRO_SUB, fill=CYAN, anchor="mt")
    return img

def frames_for_scene(idx, src, title, subtitle, dur):
    n_frames = int(dur * FPS)
    print(f"  [{idx}] {title} — {n_frames} frames")

    if src == "intro":
        base = make_intro_card()
    elif src == "outro":
        base = make_outro_card()
    else:
        base = Image.open(W_DIR / src).convert("RGB")
        base = color_grade(make_letterbox(base))
        base = draw_lower_third(base, title, subtitle)

    for f in range(n_frames):
        out_path = TMP / f"s{idx:02d}_f{f:04d}.png"
        base.save(out_path)

    return n_frames

# ── render all scenes ─────────────────────────────────────────────────────────
print("Rendering frames...")
scene_frame_counts = []
for i, (src, title, sub, dur) in enumerate(SCENES):
    n = frames_for_scene(i, src, title, sub, dur)
    scene_frame_counts.append(n)

# ── write ffmpeg concat with xfade ────────────────────────────────────────────
print("Building ffmpeg filter graph...")
overlap = int(XFADE * FPS)

# build inputs: one image sequence per scene
inputs = []
for i, (src, title, sub, dur) in enumerate(SCENES):
    n = scene_frame_counts[i]
    inputs += [
        "-framerate", str(FPS),
        "-start_number", "0",
        "-i", str(TMP / f"s{i:02d}_f%04d.png"),
    ]

# filter: xfade chain
fg_parts = []
labels   = [f"[{i}:v]" for i in range(len(SCENES))]
cur      = labels[0]
t_offset = 0.0

for i in range(1, len(SCENES)):
    prev_dur = SCENES[i-1][3]
    t_offset += prev_dur - XFADE
    out_lbl  = f"[xf{i}]"
    fg_parts.append(
        f"{cur}{labels[i]}xfade=transition=fade:duration={XFADE}:offset={t_offset:.3f}{out_lbl}"
    )
    cur = out_lbl

fg = ";".join(fg_parts)
final_map = cur

cmd = (
    ["ffmpeg", "-y"]
    + inputs
    + ["-filter_complex", fg,
       "-map", final_map,
       "-c:v", "libx264", "-preset", "slow", "-crf", "16",
       "-pix_fmt", "yuv420p",
       "-movflags", "+faststart",
       str(OUT)]
)

print("Encoding video...")
subprocess.run(cmd, check=True)

# cleanup frames
shutil.rmtree(TMP)
print(f"\n✓ Done: {OUT}")
