"""
OmniSuite ERP — 1-Minute MP4 Campaign Video Generator
Uses Python + Pillow to render frames, then ffmpeg to encode the video.
Output: omnisuite_campaign.mp4 (1920x1080, 30fps, ~60 seconds)
"""
import math, os, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

OUT_DIR   = os.path.join(os.path.dirname(__file__), "_frames")
OUT_VIDEO = os.path.join(os.path.dirname(__file__), "omnisuite_campaign.mp4")
W, H  = 1920, 1080
FPS   = 30
TOTAL = 60   # seconds
FRAMES = FPS * TOTAL

# ── BRAND COLORS ──────────────────────────────────────────────────────────────
NAVY    = (10,  22,  40, 255)
NAVY2   = (13,  30,  54, 255)
GOLD    = (245, 185,  39, 255)
GOLD_D  = (180, 130,  20, 200)
ELECTRIC= ( 79, 195, 247, 255)
WHITE   = (255, 255, 255, 255)
W70     = (255, 255, 255, 180)
W40     = (255, 255, 255, 100)
W15     = (255, 255, 255,  38)
RED     = (248,  90,  90, 255)
GREEN   = ( 74, 222, 128, 255)

# ── SCENES ───────────────────────────────────────────────────────────────────
SCENES = [
    {"name": "Problem",    "start": 0,  "end": 10},
    {"name": "Reveal",     "start": 10, "end": 20},
    {"name": "Modules",    "start": 20, "end": 32},
    {"name": "People",     "start": 32, "end": 44},
    {"name": "Dashboard",  "start": 44, "end": 54},
    {"name": "CTA",        "start": 54, "end": 60},
]

def lerp(a, b, t):
    return a + (b-a)*t

def lerp_color(c1, c2, t):
    return tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(len(c1)))

def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))

def ease_in_out(t):
    t = clamp(t)
    return t*t*(3-2*t)

def ease_out(t):
    t = clamp(t)
    return 1-(1-t)**2

# ── FONT HELPERS ──────────────────────────────────────────────────────────────
_font_cache = {}
def fnt(size, bold=False):
    key = (size, bold)
    if key not in _font_cache:
        candidates = [
            (r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf"),
            (r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"),
        ]
        loaded = None
        for p in candidates:
            if os.path.exists(p):
                loaded = ImageFont.truetype(p, size)
                break
        _font_cache[key] = loaded or ImageFont.load_default()
    return _font_cache[key]

# ── DRAW HELPERS ──────────────────────────────────────────────────────────────
def centered_text(draw, cx, y, text, font, fill):
    bb = font.getbbox(text)
    tw = bb[2] - bb[0]
    draw.text((cx - tw//2, y), text, font=font, fill=fill)

def alpha_rect(img, x, y, w, h, color_rgba, radius=0):
    ov = Image.new('RGBA', img.size, (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    if radius > 0:
        _rrect(d, [x, y, x+w, y+h], radius, fill=color_rgba)
    else:
        d.rectangle([x, y, x+w, y+h], fill=color_rgba)
    return Image.alpha_composite(img, ov)

def _rrect(draw, xy, r, fill=None, outline=None, ow=2):
    x0, y0, x1, y1 = xy
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    w = x1 - x0
    h = y1 - y0
    if w <= 0 or h <= 0:
        return
    r = min(r, w // 2, h // 2)
    if r <= 0:
        if fill:
            draw.rectangle([x0, y0, x1, y1], fill=fill)
        if outline:
            draw.rectangle([x0, y0, x1, y1], outline=outline, width=ow)
        return
    try:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill, outline=outline, width=ow)
    except Exception:
        if fill:
            draw.rectangle([x0+r, y0, x1-r, y1], fill=fill)
            draw.rectangle([x0, y0+r, x1, y1-r], fill=fill)
            for ex, ey in [(x0, y0), (x1-r*2, y0), (x0, y1-r*2), (x1-r*2, y1-r*2)]:
                draw.ellipse([ex, ey, ex+r*2, ey+r*2], fill=fill)
        if outline:
            draw.rectangle([x0, y0, x1, y1], outline=outline, width=ow)

def draw_omnisuite_logo(draw, cx, cy, r, alpha=255):
    """Draw the 3-node OmniSuite logo."""
    angles = [270, 30, 150]
    nodes = [(cx + r*math.cos(math.radians(a)), cy + r*math.sin(math.radians(a))) for a in angles]
    for i in range(3):
        for j in range(i+1, 3):
            draw.line([nodes[i], nodes[j]], fill=(*GOLD[:3], alpha), width=3)
    for nx, ny in nodes:
        nr = max(6, r//5)
        draw.ellipse([nx-nr,ny-nr,nx+nr,ny+nr], fill=(*GOLD[:3], alpha))

def draw_bg(img, t_scene):
    """Draw the animated background for a given scene."""
    d = ImageDraw.Draw(img)
    # Base fill
    d.rectangle([0,0,W,H], fill=NAVY[:3])

    # Kente grid (subtle)
    step = 80
    for x in range(0, W, step):
        d.line([(x,0),(x,H)], fill=(*GOLD[:3],8), width=1)
    for y in range(0, H, step):
        d.line([(0,y),(W,y)], fill=(*GOLD[:3],8), width=1)
    return img

def draw_particles(img, frame, n=40):
    """Draw animated particles."""
    ov = Image.new('RGBA', img.size, (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    rng = 12345
    for i in range(n):
        seed = (i*rng) & 0xFFFF
        base_x = (seed * 73 % W)
        base_y = (seed * 137 % H)
        spd_x  = ((seed * 17) % 100 - 50) * 0.004
        spd_y  = ((seed * 31) % 100 - 50) * 0.004
        px = (base_x + spd_x * frame) % W
        py = (base_y + spd_y * frame) % H
        r  = 2 + (seed % 3)
        is_gold = (i % 4 == 0)
        col = (*GOLD[:3], 60) if is_gold else (*WHITE[:3], 30)
        d.ellipse([px-r, py-r, px+r, py+r], fill=col)
    return Image.alpha_composite(img, ov)

def draw_progress(img, draw, elapsed):
    """Draw bottom progress bar."""
    pct = elapsed / TOTAL
    bx, by, bw, bh = 40, H-24, W-80, 4
    ov = Image.new('RGBA', img.size, (0,0,0,0))
    d = ImageDraw.Draw(ov)
    d.rectangle([bx, by, bx+bw, by+bh], fill=(*WHITE[:3], 30))
    d.rectangle([bx, by, bx+int(bw*pct), by+bh], fill=(*GOLD[:3], 200))
    img = Image.alpha_composite(img, ov)
    draw = ImageDraw.Draw(img)
    # Timestamp
    mins = int(elapsed//60)
    secs = int(elapsed%60)
    draw.text((bx, by-28), f"{mins}:{secs:02d} / 1:00", font=fnt(22), fill=(*WHITE[:3], 80))
    return img

def draw_watermark(draw):
    draw.text((W-300, H-46), "OmniSuite ERP", font=fnt(22), fill=(*WHITE[:3], 60))

# ══════════════════════════════════════════════════════════════════════════════
#  SCENE RENDERERS
# ══════════════════════════════════════════════════════════════════════════════

# ── SCENE 1: THE PROBLEM (0–10s) ─────────────────────────────────────────────
BROKEN_ITEMS = [
    ("[XLS]","Spreadsheets"), ("[MAIL]","Email Chains"), ("[FILE]","Paper Files"),  ("[APP]","Siloed Apps"),
    ("[TIME]","Manual Reports"),("[LOSS]","Data Loss"),  ("[DUP]","Dup. Work"),    ("[BLIND]","No Visibility"),
]
def render_scene1(img, draw, t, elapsed):
    # t: 0..1 within scene
    alpha_in = ease_out(min(t*3, 1.0))

    # Grid of 8 broken cards
    cols, rows = 4, 2
    cw, ch = 340, 180
    gap = 20
    grid_w = cols*cw + (cols-1)*gap
    grid_h = rows*ch + gap
    gx = (W - grid_w)//2
    gy = (H - grid_h)//2 - 80

    for i, (icon, label) in enumerate(BROKEN_ITEMS):
        col = i % cols
        row = i // cols
        cx = gx + col*(cw+gap)
        cy = gy + row*(ch+gap)

        # stagger
        delay = i * 0.06
        a = ease_out(clamp((t - delay)*4))
        card_alpha = int(a * alpha_in * 180)
        if card_alpha < 5:
            continue

        # Card bg
        img = alpha_rect(img, cx, cy, cw, ch, (*RED[:3], card_alpha//4), radius=12)
        ov = Image.new('RGBA', img.size, (0,0,0,0))
        od = ImageDraw.Draw(ov)
        _rrect(od, [cx,cy,cx+cw,cy+ch], 12, outline=(*RED[:3], card_alpha//2))
        img = Image.alpha_composite(img, ov)

        draw = ImageDraw.Draw(img)
        # X mark
        draw.text((cx+cw-44, cy+10), "✗", font=fnt(36, bold=True),
                  fill=(*RED[:3], card_alpha))
        # Emoji
        draw.text((cx+cw//2-24, cy+30), icon, font=fnt(44, bold=True), fill=(*WHITE[:3], card_alpha))
        # Label
        bb = fnt(32).getbbox(label)
        lw = bb[2]-bb[0]
        draw.text((cx+(cw-lw)//2, cy+ch-52), label,
                  font=fnt(32), fill=(*WHITE[:3], card_alpha//2))

    # Bottom headline
    txt_a = int(ease_out(clamp((t-0.3)*3)) * 220)
    draw.text((W//2 - 540, H-220),
              "Your business runs on too many disconnected tools.",
              font=fnt(52, bold=True), fill=(*WHITE[:3], txt_a))
    return img

# ── SCENE 2: BRAND REVEAL (10–20s) ───────────────────────────────────────────
def render_scene2(img, draw, t, elapsed):
    # Logo burst in
    logo_a = ease_out(clamp(t*2))
    logo_scale = 0.6 + 0.4 * logo_a
    logo_y = int(H*0.28 + (1-logo_a)*40)

    # Glow behind logo
    ov = Image.new('RGBA', img.size, (0,0,0,0))
    gd = ImageDraw.Draw(ov)
    glow_r = int(200 * logo_a)
    for gr in range(glow_r, 0, -8):
        ga = int(18*(1-gr/glow_r)*logo_a)
        gd.ellipse([W//2-gr, logo_y+60-gr, W//2+gr, logo_y+60+gr],
                   fill=(*GOLD[:3], ga))
    img = Image.alpha_composite(img, ov)
    draw = ImageDraw.Draw(img)

    # Logo
    logo_size = int(110 * logo_scale)
    draw_omnisuite_logo(draw, W//2 - 280, logo_y + logo_size//2, logo_size//2,
                        alpha=int(logo_a*255))

    # "OmniSuite" title
    title_a = int(logo_a * 255)
    draw.text((W//2 - 160, logo_y - 20), "Omni", font=fnt(180, bold=True),
              fill=(*WHITE[:3], title_a))
    draw.text((W//2 + 220, logo_y - 20), "Suite", font=fnt(180, bold=True),
              fill=(*GOLD[:3], title_a))

    # Subtitle
    sub_a = int(ease_out(clamp((t-0.3)*3)) * 180)
    centered_text(draw, W//2, logo_y+200,
                  "ONE SUITE  ·  EVERY OPERATION",
                  fnt(52), (*WHITE[:3], sub_a))

    # Rising chips
    pillars = ["Finance","Sales","Inventory","Human Resources","Intelligence"]
    total_w = sum(fnt(38, bold=True).getbbox(p)[2]+80 for p in pillars) + (len(pillars)-1)*16
    px = (W - total_w)//2
    py = logo_y + 310

    for i, p in enumerate(pillars):
        delay = 0.4 + i*0.07
        pa = ease_out(clamp((t-delay)*4))
        chip_a = int(pa * 200)
        if chip_a < 5:
            continue
        pw = fnt(38, bold=True).getbbox(p)[2] + 80
        img = alpha_rect(img, px, py, pw, 66, (*GOLD[:3], chip_a//5), radius=33)
        ov2 = Image.new('RGBA', img.size, (0,0,0,0))
        od2 = ImageDraw.Draw(ov2)
        _rrect(od2, [px, py, px+pw, py+66], 33, outline=(*GOLD[:3], chip_a//2))
        img = Image.alpha_composite(img, ov2)
        draw = ImageDraw.Draw(img)
        draw.text((px+40, py+14), p, font=fnt(38, bold=True), fill=(*GOLD[:3], chip_a))
        px += pw + 16

    return img

# ── SCENE 3: MODULES SHOWCASE (20–32s) ───────────────────────────────────────
MODULES = [
    ("💰","Finance"),("🛒","Sales"),("📦","Inventory"),("👥","HR"),("🏭","Production"),("🛍️","POS"),
    ("🚛","Transport"),("🔧","Maintenance"),("🏢","Facilities"),("📊","BI"),("🗂️","Projects"),("🛠️","Services"),
    ("🏦","Assets"),("📋","Purchase"),("⚙️","Admin"),("👁️","Executive"),("🌐","Multi-Branch"),("📱","Mobile"),
]
def render_scene3(img, draw, t, elapsed):
    # Title
    title_a = int(ease_out(clamp(t*3))*240)
    draw.text((W//2-480, 70), "Everything your business", font=fnt(70, bold=True),
              fill=(*WHITE[:3], title_a))
    draw.text((W//2-160, 155), "needs, connected.",        font=fnt(70, bold=True),
              fill=(*GOLD[:3], title_a))

    # 6-column module grid
    cols = 6
    rows = 3
    cw, ch = 260, 160
    gap = 14
    grid_w = cols*cw + (cols-1)*gap
    grid_h = rows*ch + (rows-1)*gap
    gx = (W-grid_w)//2
    gy = 270

    for i, (icon, label) in enumerate(MODULES):
        col = i % cols
        row = i // cols
        cx = gx + col*(cw+gap)
        cy = gy + row*(ch+gap)

        delay = i * 0.04
        a = ease_out(clamp((t-delay)*5))
        card_a = int(a * 220)
        if card_a < 5:
            continue

        # Highlight first 6 (most core)
        is_lit = i < 6
        bg_a = (*GOLD[:3], card_a//5) if is_lit else (*WHITE[:3], card_a//14)
        ol_a = (*GOLD[:3], card_a//2) if is_lit else (*WHITE[:3], card_a//4)

        img = alpha_rect(img, cx, cy, cw, ch, bg_a, radius=12)
        ov = Image.new('RGBA', img.size, (0,0,0,0))
        od = ImageDraw.Draw(ov)
        _rrect(od, [cx,cy,cx+cw,cy+ch], 12, outline=ol_a)
        img = Image.alpha_composite(img, ov)
        draw = ImageDraw.Draw(img)

        # pulse for lit cards
        if is_lit:
            pulse = 0.5 + 0.5*math.sin(elapsed*4 + i*0.8)
            draw.ellipse([cx+cw//2-5, cy+ch-14, cx+cw//2+5, cy+ch-4],
                         fill=(*GOLD[:3], int(pulse*160)))

        draw.text((cx+cw//2-22, cy+22), icon[:3], font=fnt(42, bold=True), fill=(*WHITE[:3], card_a))
        lbl_f = fnt(28, bold=True) if is_lit else fnt(24)
        lbl_c = (*GOLD[:3], card_a) if is_lit else (*WHITE[:3], card_a//2)
        bb = lbl_f.getbbox(label)
        lw = bb[2]-bb[0]
        draw.text((cx+(cw-lw)//2, cy+ch-46), label, font=lbl_f, fill=lbl_c)

    return img

# ── SCENE 4: PEOPLE (32–44s) ─────────────────────────────────────────────────
PERSONAS = [
    ("AMA", "Ama Asante",  "CFO, Accra",
     '"I see every transaction across all branches in real time. No surprises."',
     92),
    ("KWA", "Kwame Osei", "Operations Manager, Kumasi",
     '"Inventory, production, and dispatch -- all in one dashboard."',
     78),
]
def render_scene4(img, draw, t, elapsed):
    in_a = ease_out(clamp(t*2))

    # Left: Big headline
    lx = 80
    draw.text((lx, 160), "Built for",      font=fnt(150, bold=True),
              fill=(*WHITE[:3], int(in_a*255)))
    draw.text((lx, 330), "African",        font=fnt(150, bold=True),
              fill=(*GOLD[:3], int(in_a*255)))
    draw.text((lx, 500), "business.",      font=fnt(150, bold=True),
              fill=(*GOLD[:3], int(in_a*255)))

    # Body
    body_a = int(ease_out(clamp((t-0.2)*3)) * 180)
    draw.text((lx, 700),
              "OmniSuite is designed from the ground up for enterprises\n"
              "that operate across branches, manage complex supply\n"
              "chains, and need real-time visibility — wherever they are.",
              font=fnt(36), fill=(*WHITE[:3], body_a))

    # Stats
    stat_y = 870
    stats_a = int(ease_out(clamp((t-0.35)*3)) * 255)
    sx = lx
    for num, desc in [("16+","Modules"),("∞","Branches"),("Real‑Time","Visibility")]:
        draw.text((sx, stat_y),    num,  font=fnt(100, bold=True), fill=(*GOLD[:3], stats_a))
        draw.text((sx, stat_y+110),desc, font=fnt(32),             fill=(*WHITE[:3], stats_a//2))
        sx += 420

    # Right: Persona cards
    rx = int(W*0.58)
    for i, (avatar, name, role, quote, pct) in enumerate(PERSONAS):
        delay = 0.15 + i*0.15
        pa = ease_out(clamp((t-delay)*3))
        card_a = int(pa*220)
        if card_a < 5:
            continue

        card_y = 140 + i*390
        cw, ch = 680, 360

        img = alpha_rect(img, rx, card_y, cw, ch, (*WHITE[:3], card_a//14), radius=16)
        ov = Image.new('RGBA', img.size, (0,0,0,0))
        od = ImageDraw.Draw(ov)
        _rrect(od, [rx,card_y,rx+cw,card_y+ch], 16, outline=(*WHITE[:3], card_a//4))
        # Left gold accent bar
        od.rectangle([rx, card_y+16, rx+5, card_y+ch-16], fill=(*GOLD[:3], card_a))
        img = Image.alpha_composite(img, ov)
        draw = ImageDraw.Draw(img)

        # Avatar circle
        ax, ay = rx+28, card_y+24
        asize = 80
        draw.ellipse([ax, ay, ax+asize, ay+asize], fill=(*GOLD_D[:3], card_a))
        draw.text((ax+20, ay+16), avatar[:3], font=fnt(40, bold=True), fill=(*WHITE[:3], card_a))

        # Name & role
        draw.text((ax+100, ay+4),  name, font=fnt(46, bold=True), fill=(*WHITE[:3], card_a))
        draw.text((ax+100, ay+54), role, font=fnt(32),            fill=(*GOLD[:3], card_a))

        # Quote
        draw.text((rx+28, card_y+130), quote, font=fnt(34), fill=(*WHITE[:3], card_a//2))

        # Progress bar
        bar_label = "Reporting Speed" if i==0 else "Efficiency Gain"
        draw.text((rx+28, card_y+ch-90), bar_label, font=fnt(28), fill=(*WHITE[:3], card_a//3))
        # Track
        img = alpha_rect(img, rx+28, card_y+ch-52, cw-56, 8, (*WHITE[:3], card_a//5), radius=4)
        bar_w = int((cw-56) * pct/100 * pa)
        img = alpha_rect(img, rx+28, card_y+ch-52, bar_w, 8, (*GOLD[:3], card_a), radius=4)
        draw = ImageDraw.Draw(img)
        draw.text((rx+cw-80, card_y+ch-62), f"{pct}%", font=fnt(34, bold=True),
                  fill=(*GOLD[:3], card_a))

    return img

# ── SCENE 5: DASHBOARD (44–54s) ──────────────────────────────────────────────
KPIS = [
    ("Revenue MTD","₵2.4M",  "+18.4%", GREEN),
    ("Active Orders","342",  "+7.1%",  GREEN),
    ("Staff Online", "148",  "Live",   ELECTRIC),
    ("Fleet Active", "24",   "6 transit", GOLD),
]
CHART_VALS = [38, 55, 47, 82, 65, 73, 92]
ACTIVITY = [
    ("PO #4471 Approved",       "2m",  GOLD),
    ("Payroll processed · 148", "8m",  GREEN),
    ("Invoice #1882 Sent",      "14m", ELECTRIC),
    ("Stock alert Warehouse 3", "21m", RED),
    ("Fleet dispatch · 6 veh.", "35m", GOLD),
]
def render_scene5(img, draw, t, elapsed):
    in_a = ease_out(clamp(t*2))
    title_a = int(in_a*240)

    draw.text((W//2-380, 40), "Your entire business,", font=fnt(72, bold=True),
              fill=(*WHITE[:3], title_a))
    draw.text((W//2+80, 40),  "live.",                font=fnt(72, bold=True),
              fill=(*GOLD[:3], title_a))

    # Dashboard card frame
    dbx, dby = 80, 140
    dbw, dbh = W-160, H-200
    card_a = int(in_a*200)

    img = alpha_rect(img, dbx, dby, dbw, dbh, (*WHITE[:3], card_a//14), radius=16)
    ov = Image.new('RGBA', img.size, (0,0,0,0))
    od = ImageDraw.Draw(ov)
    _rrect(od, [dbx,dby,dbx+dbw,dby+dbh], 16, outline=(*WHITE[:3], card_a//4))
    img = Image.alpha_composite(img, ov)

    # Titlebar
    img = alpha_rect(img, dbx, dby, dbw, 64, (*WHITE[:3], card_a//8), radius=16)
    draw = ImageDraw.Draw(img)
    for i, dc in enumerate([(255,95,86),(255,189,46),(39,201,63)]):
        draw.ellipse([dbx+16+i*28, dby+22, dbx+38+i*28, dby+44], fill=dc)
    draw.text((dbx+120, dby+18),
              "OmniSuite ERP — Executive Dashboard — All Branches",
              font=fnt(28), fill=(*WHITE[:3], card_a//2))
    draw.rectangle([dbx, dby+64, dbx+dbw, dby+66], fill=(*WHITE[:3], card_a//8))

    content_y = dby+80

    # KPI grid (2x2 left half)
    kpi_area_w = (dbw)//2 - 20
    for i, (lbl, val, chg, chg_col) in enumerate(KPIS):
        delay = i * 0.08
        ka = int(ease_out(clamp((t-delay)*4)) * card_a)
        if ka < 5:
            continue
        col = i % 2
        row = i // 2
        kx = dbx + 20 + col*(kpi_area_w//2 + 10)
        ky = content_y + 20 + row*220

        kw, kh = kpi_area_w//2 - 10, 200
        img = alpha_rect(img, kx, ky, kw, kh, (*WHITE[:3], ka//12), radius=10)
        ov2 = Image.new('RGBA', img.size, (0,0,0,0))
        od2 = ImageDraw.Draw(ov2)
        _rrect(od2, [kx,ky,kx+kw,ky+kh], 10, outline=(*WHITE[:3], ka//5))
        img = Image.alpha_composite(img, ov2)
        draw = ImageDraw.Draw(img)
        draw.text((kx+16, ky+14), lbl, font=fnt(28), fill=(*WHITE[:3], ka//2))
        draw.text((kx+16, ky+50), val, font=fnt(80, bold=True), fill=(*WHITE[:3], ka))
        draw.text((kx+16, ky+145), chg, font=fnt(30), fill=(*chg_col[:3], ka))

    # Chart (right side)
    chart_x = dbx + kpi_area_w + 30
    chart_y  = content_y + 20
    chart_w  = dbw - kpi_area_w - 50
    chart_h  = 440

    chart_a = int(ease_out(clamp((t-0.2)*3)) * card_a)
    draw.text((chart_x, chart_y), "SALES TREND — 7 DAYS",
              font=fnt(28), fill=(*WHITE[:3], chart_a//2))

    bar_w = (chart_w - 6*12) // 7
    days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    max_v = max(CHART_VALS)
    for i, v in enumerate(CHART_VALS):
        bx = chart_x + i*(bar_w+12)
        bh_full = int((v/max_v) * (chart_h-60))
        # Animate bars growing
        bh = int(bh_full * ease_out(clamp((t-0.1-i*0.04)*5)))
        by = chart_y + chart_h - bh - 40
        is_hi = v >= max_v*0.85
        bc = (*GOLD[:3], chart_a) if is_hi else (*GOLD[:3], chart_a//3)
        img = alpha_rect(img, bx, by, bar_w, bh, bc, radius=4)
        draw = ImageDraw.Draw(img)
        draw.text((bx, chart_y+chart_h-32), days[i], font=fnt(22),
                  fill=(*WHITE[:3], chart_a//3))

    # Activity list (bottom)
    act_y = content_y + 490
    draw.rectangle([dbx+20, act_y-10, dbx+dbw-20, act_y-8],
                   fill=(*WHITE[:3], card_a//8))
    draw.text((dbx+20, act_y+2), "RECENT ACTIVITY", font=fnt(26),
              fill=(*WHITE[:3], card_a//3))
    for i, (text, time_str, dot_col) in enumerate(ACTIVITY):
        delay = 0.3 + i*0.06
        aa = int(ease_out(clamp((t-delay)*4)) * card_a)
        if aa < 5:
            continue
        ay = act_y + 45 + i*60
        draw.ellipse([dbx+20, ay+8, dbx+32, ay+20], fill=(*dot_col[:3], aa))
        draw.text((dbx+44, ay), text, font=fnt(30), fill=(*WHITE[:3], aa//2))
        draw.text((dbx+dbw-100, ay), time_str, font=fnt(26),
                  fill=(*WHITE[:3], aa//4))
        draw.rectangle([dbx+20, ay+54, dbx+dbw-20, ay+56],
                       fill=(*WHITE[:3], aa//10))

    return img

# ── SCENE 6: CTA (54–60s) ────────────────────────────────────────────────────
def render_scene6(img, draw, t, elapsed):
    in_a = ease_out(clamp(t*2))

    # Eyebrow
    ey_a = int(ease_out(clamp((t-0.0)*4)) * 200)
    centered_text(draw, W//2, 200,
                  "OmniSuite ERP  —  Stanness Technologies",
                  fnt(38), (*GOLD[:3], ey_a))

    # Main headline
    h1_a = int(ease_out(clamp((t-0.08)*4)) * 255)
    centered_text(draw, W//2, 280, "One Suite.",  fnt(220, bold=True), (*WHITE[:3], h1_a))
    centered_text(draw, W//2, 510, "Every",       fnt(220, bold=True), (*GOLD[:3], h1_a))
    centered_text(draw, W//2, 740, "Operation.",  fnt(220, bold=True), (*GOLD[:3], h1_a))

    # Sub
    sub_a = int(ease_out(clamp((t-0.25)*4)) * 180)
    centered_text(draw, W//2, 970,
                  "Finance  ·  Sales  ·  HR  ·  Inventory  ·  Production  ·  Intelligence",
                  fnt(40), (*WHITE[:3], sub_a))
    centered_text(draw, W//2, 1022,
                  "All connected  ·  All in real time  ·  All yours.",
                  fnt(40), (*WHITE[:3], sub_a))

    # Logo footer
    logo_a = int(ease_out(clamp((t-0.4)*3)) * 200)
    lcx = W//2
    lcy = H - 120
    draw_omnisuite_logo(draw, lcx-160, lcy, 30, alpha=logo_a)
    draw.text((lcx-100, lcy-28), "Omni", font=fnt(60, bold=True), fill=(*WHITE[:3], logo_a))
    draw.text((lcx+80,  lcy-28), "Suite", font=fnt(60, bold=True), fill=(*GOLD[:3], logo_a))
    draw.text((lcx-120, lcy+40), "stannesstechnologies.com",
              font=fnt(30), fill=(*WHITE[:3], logo_a//2))

    # Gold glow behind text (pulse)
    pulse = 0.5 + 0.5*math.sin(elapsed*2)
    ov = Image.new('RGBA', img.size, (0,0,0,0))
    gd = ImageDraw.Draw(ov)
    for r in range(300, 0, -10):
        ga = int(6 * (1-r/300) * pulse * in_a)
        gd.ellipse([W//2-r*2, H//2-r, W//2+r*2, H//2+r], fill=(*GOLD[:3], ga))
    img = Image.alpha_composite(img, ov)
    draw = ImageDraw.Draw(img)

    return img

# ══════════════════════════════════════════════════════════════════════════════
#  MAIN RENDER LOOP
# ══════════════════════════════════════════════════════════════════════════════
SCENE_RENDERERS = [
    render_scene1, render_scene2, render_scene3,
    render_scene4, render_scene5, render_scene6,
]

def get_scene_idx(elapsed):
    for i, s in enumerate(SCENES):
        if s["start"] <= elapsed < s["end"]:
            return i
    return len(SCENES)-1

def render_frame(frame_num):
    elapsed = frame_num / FPS
    scene_idx = get_scene_idx(elapsed)
    scene = SCENES[scene_idx]
    t = (elapsed - scene["start"]) / (scene["end"] - scene["start"])
    t = clamp(t)

    # Scene transition fade
    fade_dur = 0.5  # seconds
    fade_in  = clamp(elapsed - scene["start"]) / fade_dur if fade_dur > 0 else 1.0
    fade_out = 1.0
    if scene["end"] - elapsed < fade_dur:
        fade_out = (scene["end"] - elapsed) / fade_dur

    global_alpha = clamp(min(fade_in, fade_out)) if elapsed > 0.3 else ease_out(elapsed/0.3)

    # Base image
    img = Image.new('RGBA', (W, H), NAVY[:3])
    img = draw_bg(img, t)
    img = draw_particles(img, frame_num)

    draw = ImageDraw.Draw(img)

    # Render scene
    img = SCENE_RENDERERS[scene_idx](img, draw, t, elapsed)
    draw = ImageDraw.Draw(img)

    # Fade overlay
    if global_alpha < 0.98:
        ov = Image.new('RGBA', img.size, (0,0,0,0))
        od = ImageDraw.Draw(ov)
        od.rectangle([0,0,W,H], fill=(0,0,0, int((1-global_alpha)*255)))
        img = Image.alpha_composite(img, ov)
        draw = ImageDraw.Draw(img)

    # HUD
    img = draw_progress(img, draw, elapsed)
    draw = ImageDraw.Draw(img)
    draw_watermark(draw)

    return img.convert('RGB')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"Rendering {FRAMES} frames at {FPS}fps ({TOTAL}s)...")
    for f in range(FRAMES):
        frame = render_frame(f)
        frame.save(os.path.join(OUT_DIR, f"frame_{f:04d}.png"))
        if f % (FPS*5) == 0:
            print(f"  Frame {f}/{FRAMES}  ({f/FRAMES*100:.0f}%)")

    print("Encoding MP4 with ffmpeg...")
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(OUT_DIR, "frame_%04d.png"),
        "-vf", f"scale={W}:{H}",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        OUT_VIDEO,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("ffmpeg stderr:", result.stderr[-2000:])
    else:
        size_mb = os.path.getsize(OUT_VIDEO)/1024/1024
        print(f"[OK] Video saved: {OUT_VIDEO}  ({size_mb:.1f} MB)")

    # Clean up frames
    shutil.rmtree(OUT_DIR, ignore_errors=True)
    print("[OK] Temp frames cleaned up.")


if __name__ == "__main__":
    main()
