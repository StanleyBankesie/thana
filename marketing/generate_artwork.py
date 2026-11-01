"""
OmniSuite ERP — Marketing Artwork PNG Generator
Generates a high-resolution 3840x2160 (4K) PNG poster.
"""
import math, os, urllib.request, tempfile
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "omnisuite_artwork.png")
W, H = 3840, 2160

# ── BRAND COLORS ─────────────────────────────────────────────────────────────
NAVY        = (10,  22,  40)
NAVY_MID    = (13,  30,  54)
NAVY_LIGHT  = (20,  44,  72)
GOLD        = (245, 185,  39)
GOLD_DIM    = (180, 130,  20)
GOLD_A20    = (245, 185,  39,  50)
ELECTRIC    = ( 79, 195, 247)
WHITE       = (255, 255, 255)
W70         = (255, 255, 255, 180)
W40         = (255, 255, 255, 100)
W15         = (255, 255, 255,  38)
RED_SOFT    = (248,  90,  90)
GREEN_SOFT  = ( 74, 222, 128)

# ── FONT LOADER ──────────────────────────────────────────────────────────────
def load_font(size, bold=False):
    """Try to load Inter/Arial; fall back to default."""
    candidates = [
        r"C:\Windows\Fonts\arial.ttf"   if not bold else r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeui.ttf" if not bold else r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\calibri.ttf" if not bold else r"C:\Windows\Fonts\calibrib.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

# ── HELPERS ──────────────────────────────────────────────────────────────────
def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i]-c1[i])*t) for i in range(len(c1)))

def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, outline_width=2):
    x0, y0, x1, y1 = xy
    r = radius
    if fill:
        draw.rectangle([x0+r, y0, x1-r, y1], fill=fill)
        draw.rectangle([x0, y0+r, x1, y1-r], fill=fill)
        draw.ellipse([x0, y0, x0+r*2, y0+r*2], fill=fill)
        draw.ellipse([x1-r*2, y0, x1, y0+r*2], fill=fill)
        draw.ellipse([x0, y1-r*2, x0+r*2, y1], fill=fill)
        draw.ellipse([x1-r*2, y1-r*2, x1, y1], fill=fill)
    if outline:
        draw.arc([x0, y0, x0+r*2, y0+r*2], 180, 270, fill=outline, width=outline_width)
        draw.arc([x1-r*2, y0, x1, y0+r*2], 270, 360, fill=outline, width=outline_width)
        draw.arc([x0, y1-r*2, x0+r*2, y1], 90, 180,  fill=outline, width=outline_width)
        draw.arc([x1-r*2, y1-r*2, x1, y1], 0,   90,  fill=outline, width=outline_width)
        draw.line([x0+r, y0, x1-r, y0], fill=outline, width=outline_width)
        draw.line([x0+r, y1, x1-r, y1], fill=outline, width=outline_width)
        draw.line([x0, y0+r, x0, y1-r], fill=outline, width=outline_width)
        draw.line([x1, y0+r, x1, y1-r], fill=outline, width=outline_width)

def alpha_composite_color(base_img, x, y, w, h, color_rgba):
    """Draw a semi-transparent rectangle on an RGBA image."""
    overlay = Image.new('RGBA', base_img.size, (0,0,0,0))
    d = ImageDraw.Draw(overlay)
    d.rectangle([x, y, x+w, y+h], fill=color_rgba)
    return Image.alpha_composite(base_img, overlay)

def draw_node_network(draw, cx, cy, radius, node_r=28, color=GOLD):
    """Draw the OmniSuite hexagonal network motif."""
    angles = [270, 330, 30, 90, 150, 210]  # 6 outer nodes
    nodes = []
    for a in angles:
        rad = math.radians(a)
        nx = cx + radius * math.cos(rad)
        ny = cy + radius * math.sin(rad)
        nodes.append((nx, ny))

    # Draw connection lines (dim)
    for i in range(len(nodes)):
        for j in range(i+1, len(nodes)):
            # Only adjacent + cross
            if abs(i-j) <= 2 or abs(i-j) >= 4:
                a = (*color[:3], 40)
                draw.line([(nodes[i][0], nodes[i][1]), (nodes[j][0], nodes[j][1])],
                          fill=a, width=3)

    # Hub lines to center
    for n in nodes:
        draw.line([(cx, cy), n], fill=(*color[:3], 25), width=2)

    # Center hub
    draw.ellipse([cx-36, cy-36, cx+36, cy+36], outline=(*color[:3], 100), width=3)
    draw.ellipse([cx-14, cy-14, cx+14, cy+14], fill=(*color[:3], 160))

    # Outer nodes
    for i, (nx, ny) in enumerate(nodes):
        nr = node_r * (0.8 if i % 2 else 1.0)
        draw.ellipse([nx-nr, ny-nr, nx+nr, ny+nr], fill=(*color[:3], 220))

    # Inner electric nodes
    inner_angles = [0, 60, 120, 180, 240, 300]
    inner_r = radius * 0.55
    for a in inner_angles:
        rad = math.radians(a)
        nx = cx + inner_r * math.cos(rad)
        ny = cy + inner_r * math.sin(rad)
        draw.ellipse([nx-14, ny-14, nx+14, ny+14], fill=(*ELECTRIC[:3], 120))
        draw.line([(cx, cy), (nx, ny)], fill=(*ELECTRIC[:3], 30), width=2)

    return nodes

def draw_bar_chart(draw, x, y, w, h, values, color=GOLD, bg=(255,255,255,20)):
    bar_w = (w - (len(values)-1)*8) // len(values)
    max_v = max(values)
    for i, v in enumerate(values):
        bh = int((v/max_v) * h)
        bx = x + i*(bar_w+8)
        by = y + h - bh
        is_hi = v == max_v or v > max_v*0.85
        c = color if is_hi else (*color[:3], 80)
        draw_rounded_rect(draw, [bx, by, bx+bar_w, y+h], radius=6, fill=c)


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN RENDER
# ═══════════════════════════════════════════════════════════════════════════════
def render():
    img = Image.new('RGBA', (W, H), NAVY)

    # ── 1. BACKGROUND GRADIENT ──
    grad = Image.new('RGBA', (W, H), (0,0,0,0))
    gd = ImageDraw.Draw(grad)
    for y in range(H):
        t = y / H
        c = lerp_color((13,30,54,255), (10,22,40,255), t)
        gd.line([(0, y), (W, y)], fill=c)
    img = Image.alpha_composite(img, grad)

    # ── 2. KENTE GRID OVERLAY ──
    kente = Image.new('RGBA', (W, H), (0,0,0,0))
    kd = ImageDraw.Draw(kente)
    step = 80
    for x in range(0, W, step):
        kd.line([(x,0),(x,H)], fill=(*GOLD[:3], 10), width=1)
    for y in range(0, H, step):
        kd.line([(0,y),(W,y)], fill=(*GOLD[:3], 10), width=1)
    img = Image.alpha_composite(img, kente)

    # ── 3. RADIAL GLOW (right-center) ──
    glow = Image.new('RGBA', (W, H), (0,0,0,0))
    gd2 = ImageDraw.Draw(glow)
    # Gold glow — right side
    for r in range(800, 0, -40):
        a = int(12 * (1 - r/800))
        gd2.ellipse([W*0.55 - r*1.5, H*0.5 - r, W*0.55 + r*1.5, H*0.5 + r],
                    fill=(*GOLD[:3], a))
    # Electric glow — left side
    for r in range(600, 0, -40):
        a = int(8 * (1 - r/600))
        gd2.ellipse([W*0.1 - r*1.2, H*0.5 - r, W*0.1 + r*1.2, H*0.5 + r],
                    fill=(*ELECTRIC[:3], a))
    img = Image.alpha_composite(img, glow)

    draw = ImageDraw.Draw(img)

    # ── 4. ORBIT NETWORK (top-right area) ──
    net_cx, net_cy = int(W*0.78), int(H*0.36)
    net_r = int(H*0.33)

    # Outer ring
    draw.ellipse([net_cx - net_r, net_cy - net_r, net_cx + net_r, net_cy + net_r],
                 outline=(*GOLD[:3], 30), width=2)
    # Mid ring
    mid_r = int(net_r * 0.65)
    draw.ellipse([net_cx - mid_r, net_cy - mid_r, net_cx + mid_r, net_cy + mid_r],
                 outline=(*GOLD[:3], 18), width=2)

    nodes = draw_node_network(draw, net_cx, net_cy, net_r, node_r=32)

    # ── 5. LEFT CONTENT COLUMN ──
    left_x = int(W * 0.05)
    left_w = int(W * 0.47)
    cy_start = int(H * 0.12)

    # Eyebrow line + label
    ey_y = cy_start
    draw.rectangle([left_x, ey_y+18, left_x+80, ey_y+24], fill=GOLD)
    font_eyebrow = load_font(38, bold=True)
    draw.text((left_x+100, ey_y+2), "ENTERPRISE RESOURCE PLANNING",
              font=font_eyebrow, fill=(*GOLD[:3], 200))

    # HEADLINE
    headline_y = ey_y + 90
    font_h1 = load_font(260, bold=True)
    font_h1_med = load_font(240, bold=True)

    draw.text((left_x, headline_y),        "One Suite.",  font=font_h1,     fill=WHITE)
    draw.text((left_x, headline_y + 280),  "Every",       font=font_h1_med, fill=GOLD)
    draw.text((left_x, headline_y + 530),  "Operation.",  font=font_h1_med, fill=GOLD)

    # Divider
    div_y = headline_y + 810
    draw.rectangle([left_x, div_y, left_x+160, div_y+8],
                   fill=(*GOLD[:3], 200))

    # Body text
    body_y = div_y + 50
    font_body = load_font(52)
    body_lines = [
        "OmniSuite connects your Finance, Sales, Inventory,",
        "HR, Production, and 11 more modules — into a single",
        "real-time intelligence platform built for the African",
        "enterprise.",
    ]
    for i, line in enumerate(body_lines):
        draw.text((left_x, body_y + i*68), line, font=font_body, fill=(*WHITE[:3], 170))

    # MODULE CHIPS
    chips_y = body_y + 330
    chips = ["Finance","Sales","Inventory","HR","Production",
             "POS","Transport","Intelligence","Assets","Projects"]
    font_chip = load_font(36, bold=True)
    chip_x = left_x
    chip_row_y = chips_y
    for i, chip in enumerate(chips):
        tw = font_chip.getbbox(chip)[2] + 60
        th = 58
        if chip_x + tw > left_x + left_w:
            chip_x = left_x
            chip_row_y += 78
        # background
        chip_ol = Image.new('RGBA', img.size, (0,0,0,0))
        cd = ImageDraw.Draw(chip_ol)
        draw_rounded_rect(cd,
            [chip_x, chip_row_y, chip_x+tw, chip_row_y+th],
            radius=29,
            fill=(*GOLD[:3], 28),
            outline=(*GOLD[:3], 90),
            outline_width=2)
        img = Image.alpha_composite(img, chip_ol)
        draw = ImageDraw.Draw(img)
        draw.text((chip_x + 30, chip_row_y + 10), chip,
                  font=font_chip, fill=(*GOLD[:3], 230))
        chip_x += tw + 18

    # STATS ROW
    stat_y = chip_row_y + 110
    stats = [("16+", "Integrated Modules"), ("∞", "Branch Support"), ("Real-Time", "Visibility")]
    font_stat_n = load_font(120, bold=True)
    font_stat_d = load_font(36)
    sx = left_x
    for num, desc in stats:
        draw.text((sx, stat_y),      num,  font=font_stat_n, fill=GOLD)
        draw.text((sx, stat_y+130),  desc, font=font_stat_d, fill=(*WHITE[:3], 100))
        sx += 420

    # LOGO LOCKUP (bottom of left column)
    logo_y = int(H * 0.88)
    # Separator line
    draw.rectangle([left_x, logo_y-12, left_x+left_w, logo_y-10],
                   fill=(*WHITE[:3], 15))
    # Logo SVG-style nodes
    lnx, lny, lnr = left_x+50, logo_y+50, 50
    logo_nodes = [(lnx, lny-lnr), (lnx+lnr*0.87, lny+lnr*0.5),
                  (lnx-lnr*0.87, lny+lnr*0.5)]
    for an, bn in [(0,1),(1,2),(2,0)]:
        draw.line([logo_nodes[an], logo_nodes[bn]], fill=(*GOLD[:3],160), width=4)
    for nx, ny in logo_nodes:
        draw.ellipse([nx-16, ny-16, nx+16, ny+16], fill=GOLD)

    font_logo = load_font(90, bold=True)
    draw.text((left_x+140, logo_y+4), "OmniSuite", font=font_logo, fill=WHITE)
    font_domain = load_font(38)
    draw.text((left_x+140, logo_y+110), "stannesstechnologies.com  ·  By Stanness Technologies",
              font=font_domain, fill=(*WHITE[:3], 100))

    # ── 6. RIGHT PANEL — DASHBOARD CARD ──
    right_x = int(W * 0.555)
    right_w = int(W * 0.40)
    right_y = int(H * 0.10)

    # Card background
    card_h = int(H * 0.56)
    card_ol = Image.new('RGBA', img.size, (0,0,0,0))
    cd2 = ImageDraw.Draw(card_ol)
    draw_rounded_rect(cd2, [right_x, right_y, right_x+right_w, right_y+card_h],
                      radius=28,
                      fill=(255,255,255,10),
                      outline=(255,255,255,26),
                      outline_width=2)
    img = Image.alpha_composite(img, card_ol)
    draw = ImageDraw.Draw(img)

    # Titlebar
    tb_h = 80
    tb_ol = Image.new('RGBA', img.size, (0,0,0,0))
    tb_d = ImageDraw.Draw(tb_ol)
    draw_rounded_rect(tb_d, [right_x, right_y, right_x+right_w, right_y+tb_h],
                      radius=28, fill=(255,255,255,14))
    img = Image.alpha_composite(img, tb_ol)
    draw = ImageDraw.Draw(img)

    # Dots
    for i, dc in enumerate([(255,95,86),(255,189,46),(39,201,63)]):
        draw.ellipse([right_x+40+i*44, right_y+28, right_x+72+i*44, right_y+60], fill=dc)

    font_tb = load_font(36)
    draw.text((right_x+190, right_y+22),
              "OmniSuite ERP  ·  Executive Dashboard  ·  All Branches",
              font=font_tb, fill=(*WHITE[:3], 100))

    # Separator
    draw.rectangle([right_x, right_y+tb_h, right_x+right_w, right_y+tb_h+2],
                   fill=(*WHITE[:3], 20))

    # KPI GRID (2x2)
    kpi_data = [
        ("Revenue MTD", "₵2.4M",  "+18.4%", GREEN_SOFT),
        ("Active Orders", "342",   "+7.1%",  GREEN_SOFT),
        ("Staff Online",  "148",   "Live",   ELECTRIC),
        ("Fleet Active",  "24",    "6 transit", GOLD),
    ]
    kpi_x0 = right_x + 30
    kpi_y0 = right_y + tb_h + 30
    kpi_w  = (right_w - 80) // 2
    kpi_h  = 220
    font_kl = load_font(34)
    font_kv = load_font(100, bold=True)
    font_kd = load_font(34)

    for i, (lbl, val, chg, chg_col) in enumerate(kpi_data):
        col = i % 2
        row = i // 2
        kx = kpi_x0 + col*(kpi_w+20)
        ky = kpi_y0 + row*(kpi_h+16)

        kpi_ol2 = Image.new('RGBA', img.size, (0,0,0,0))
        kd3 = ImageDraw.Draw(kpi_ol2)
        draw_rounded_rect(kd3, [kx, ky, kx+kpi_w, ky+kpi_h], radius=14,
                          fill=(255,255,255,12), outline=(255,255,255,20), outline_width=2)
        img = Image.alpha_composite(img, kpi_ol2)
        draw = ImageDraw.Draw(img)
        draw.text((kx+20, ky+16), lbl, font=font_kl, fill=(*WHITE[:3], 100))
        draw.text((kx+20, ky+52), val, font=font_kv, fill=WHITE)
        draw.text((kx+20, ky+165), chg, font=font_kd, fill=chg_col)

    # CHART SECTION
    chart_y = kpi_y0 + kpi_h*2 + 60
    font_cl = load_font(34)
    draw.text((right_x+30, chart_y), "SALES TREND  —  7 DAYS  ·  ALL BRANCHES",
              font=font_cl, fill=(*WHITE[:3], 100))
    chart_values = [38, 55, 47, 82, 65, 73, 92]
    draw_bar_chart(draw,
                   right_x+30, chart_y+55, right_w-60, 200,
                   chart_values, color=GOLD)

    # Date labels under bars
    days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    day_font = load_font(28)
    bw = (right_w-60-6*8)//7
    for i, d in enumerate(days):
        bx = right_x+30 + i*(bw+8) + bw//2
        draw.text((bx-20, chart_y+265), d, font=day_font, fill=(*WHITE[:3], 70))

    # ── 7. SECONDARY STAT BAR (bottom of right panel area) ──
    # Draw small accent lines / dots linking the orbit to the dashboard
    draw.ellipse([int(W*0.54)-6, int(H*0.50)-6, int(W*0.54)+6, int(H*0.50)+6],
                 fill=(*GOLD[:3], 120))
    draw.line([(int(W*0.54), int(H*0.50)), (int(W*0.59), int(H*0.50))],
              fill=(*GOLD[:3], 40), width=1)

    # ── 8. CORNER MARKS ──
    cm = 50
    cp = 32
    for (cx0, cy0, cx1, cy1) in [
        (cp, cp, cp+cm, cp),     # TL horizontal
        (cp, cp, cp, cp+cm),     # TL vertical
        (W-cp-cm, cp, W-cp, cp), # TR horizontal
        (W-cp, cp, W-cp, cp+cm), # TR vertical
        (cp, H-cp, cp+cm, H-cp), # BL horizontal
        (cp, H-cp-cm, cp, H-cp), # BL vertical
        (W-cp-cm, H-cp, W-cp, H-cp), # BR horizontal
        (W-cp, H-cp-cm, W-cp, H-cp), # BR vertical
    ]:
        draw.line([(cx0, cy0),(cx1, cy1)], fill=(*GOLD[:3], 60), width=3)

    # ── 9. BOTTOM GRADIENT BAR ──
    for x in range(W):
        t = x / W
        if t < 0.3:
            c = lerp_color((0,0,0,0), (*GOLD[:3], 180), t/0.3)
        elif t < 0.7:
            c = lerp_color((*GOLD[:3], 180), (*ELECTRIC[:3], 180), (t-0.3)/0.4)
        else:
            c = lerp_color((*ELECTRIC[:3], 180), (0,0,0,0), (t-0.7)/0.3)
        draw.line([(x, H-8),(x, H-2)], fill=c)

    # ── SAVE ──
    out_rgb = img.convert('RGB')
    out_rgb.save(OUT, 'PNG', optimize=False, compress_level=1)
    print(f"[OK] Artwork saved: {OUT}")
    print(f"     Size: {W}x{H} px  ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    render()
