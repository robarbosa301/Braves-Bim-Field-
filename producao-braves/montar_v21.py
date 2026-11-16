import json, subprocess, math, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

BASE = "/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"
V = BASE + "video1/"; O = V + "original/"
D85 = O + "d85092fc309e478386ee3aa26252ef52.mov"; RAW = O + "IMG_2302.MOV"
HDRC = "zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=1000,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.3:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=gamma=1.08:saturation=1.05"
F2303, F2304, F5FFB = O + "IMG_2303.MOV", O + "IMG_2304.MOV", O + "5FFBA875-880F-4041-9085-4A4C1F33B61D.mp4"
ANTON = BASE + "fontes/Anton-Regular.ttf"
W, H, FPS = 1080, 1920, 30
YEL, WHITE, CYAN, RED, DARK, NAVY = (255, 196, 0), (255, 255, 255), (0, 229, 255), (225, 6, 0), (20, 20, 24), (9, 22, 52)
def F(sz): return ImageFont.truetype(ANTON, sz)
def ease(p): p = min(max(p, 0.0), 1.0); return 1 - (1 - p) ** 3
def easeio(p): p = min(max(p, 0.0), 1.0); return 3 * p * p - 2 * p ** 3
def back(p):  # overshoot
    p = min(max(p, 0.0), 1.0); c = 1.70158; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2
def lerp(a, b, e): return a + (b - a) * e

SEGS = [(0.0, 10.74, 0.0), (11.98, 20.58, 10.74), (21.18, 29.5, 19.34)]
TOTAL = 28.4
def m(ts):
    for a, b, o in SEGS:
        if a <= ts <= b: return ts - a + o
FIX = {"Mundo": "Mão", "Bravos,": "Braves,", "Bravos.": "Braves.", "ouçamentária.": "orçamentária.", "Nick": "link"}
words = []
for x in json.load(open(V + "p_d85092fc309e478386ee3aa26252ef52.json")):
    s, e = m(x["s"] + 0.001), m(x["e"] - 0.001)
    if s is None or e is None: continue
    words.append({"w": FIX.get(x["w"], x["w"]), "s": s, "e": e})
groups, cur = [], []
for i, x in enumerate(words):
    cur.append(x); gap = words[i + 1]["s"] - x["e"] if i + 1 < len(words) else 9
    if len(cur) == 3 or x["w"][-1] in ".,?!" or gap > 0.25: groups.append(cur); cur = []
if cur: groups.append(cur)
def tw_(w0): return m(w0)  # tempo novo de um tempo original

SHOTS = [(0.0, 3.0, RAW, 3.19, "fala"), (3.0, 6.7, RAW, 6.19, "fala"), (6.7, 10.74, F2304, 1.5, "b"),
         (10.74, 15.04, F2303, 0.5, "b"), (15.04, 19.34, F2304, 12.0, "b"), (19.34, 24.08, F5FFB, 31.0, "b"),
         (24.08, TOTAL, F2304, 22.0, "b")]
T_SHRINK, T_FLIP = 1.75, 6.7
TRANS = {10.74: ("lens", 0.80), 15.04: ("bricks", 0.85), 19.34: ("section", 0.80), 24.08: ("tiles", 0.80)}

def clean(fr):
    band = fr[1020:1120]
    mask = (band.min(axis=2) > 205).astype(np.uint8) * 255
    mask[:, :140] = 0; mask[:, 940:] = 0
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=3)
    if mask.any(): fr[1020:1120] = cv2.inpaint(band, mask, 5, cv2.INPAINT_TELEA)
    return fr

# ================= utilidades de desenho =================
def canvas(w, h): return Image.new("RGBA", (w, h), (0, 0, 0, 0))
def tw(d, t, f, sw=0):
    b = d.textbbox((0, 0), t, font=f, stroke_width=sw); return b[2] - b[0], b[3] - b[1]
def blend(frame, rgba, x=0, y=0, alpha=1.0):
    h, w = rgba.shape[:2]; x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0: return
    sub = rgba[y0 - y:y1 - y, x0 - x:x1 - x]; a = sub[..., 3:4].astype(np.float32) / 255 * alpha
    reg = frame[y0:y1, x0:x1].astype(np.float32)
    frame[y0:y1, x0:x1] = (reg * (1 - a) + sub[..., :3] * a).astype(np.uint8)
def ss(w, h, fn, k=2):
    """desenha em resolução dobrada e reduz (bordas suaves)"""
    im = canvas(w * k, h * k); d = ImageDraw.Draw(im); fn(d, k); return np.array(im.resize((w, h), Image.LANCZOS))

# ---------- fundo "planta" animado ----------
_grad = np.zeros((H, W, 3), np.uint8)
for c, (a, b) in enumerate(zip((14, 34, 78), (5, 12, 32))): _grad[..., c] = np.linspace(a, b, H)[:, None]
_grid = np.zeros((H + 120, W + 120), np.uint8)
for i in range(0, W + 120, 60): _grid[:, i] = 255 if i % 240 else 255
for j in range(0, H + 120, 60): _grid[j, :] = 255
_grid_big = np.zeros_like(_grid)
for i in range(0, W + 120, 240): _grid_big[:, i] = 255
for j in range(0, H + 120, 240): _grid_big[j, :] = 255
_rng = random.Random(4)
PLUS = [(_rng.randint(60, 1020), _rng.randint(120, 1800), _rng.uniform(0.6, 1.6), _rng.uniform(0, 6)) for _ in range(26)]
def stage_bg(t):
    bg = _grad.copy(); dx, dy = int(t * 14) % 60, int(t * 9) % 60
    g = _grid[dy:dy + H, dx:dx + W] > 0; gb = _grid_big[dy:dy + H, dx:dx + W] > 0
    bg[g] = (bg[g] * 0.90 + np.array(CYAN) * 0.10).astype(np.uint8)
    bg[gb] = (bg[gb] * 0.80 + np.array(CYAN) * 0.20).astype(np.uint8)
    for (x, y, sp, ph) in PLUS:
        yy = int((y - t * 26 * sp) % H); a = 0.35 + 0.25 * math.sin(t * 2 + ph)
        col = tuple(int(c * a + b * (1 - a)) for c, b in zip(CYAN, (20, 40, 80)))
        cv2.line(bg, (x - 9, yy), (x + 9, yy), col, 3); cv2.line(bg, (x, yy - 9), (x, yy + 9), col, 3)
    return bg

# ---------- cartão (você / imagens) ----------
CARD = (230, 940, 620, 490)   # x, y, w, h
SC = 0.574
def rmask(w, h, r):
    mk = Image.new("L", (w, h), 0); ImageDraw.Draw(mk).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return np.array(mk)
def put_scaled(canvas_rgb, src, scale, off, win, radius, border=0, fx=1.0):
    """cola src (escala 'scale', canto em 'off') cortado pela janela win=(x,y,w,h)"""
    x, y, w, h = [int(round(v)) for v in win]
    if w < 4 or h < 4: return
    # fx: achatamento horizontal (virada do cartão)
    ww = max(4, int(w * fx)); xo = x + (w - ww) // 2
    sw_, sh_ = int(src.shape[1] * scale), int(src.shape[0] * scale)
    sm = cv2.resize(src, (sw_, sh_), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
    # região da janela dentro da imagem escalada
    ox, oy = int(off[0]), int(off[1])
    tile = np.zeros((h, w, 3), np.uint8)
    sx0, sy0 = x - ox, y - oy
    ax0, ay0 = max(0, sx0), max(0, sy0); ax1, ay1 = min(sw_, sx0 + w), min(sh_, sy0 + h)
    if ax1 > ax0 and ay1 > ay0: tile[ay0 - sy0:ay1 - sy0, ax0 - sx0:ax1 - sx0] = sm[ay0:ay1, ax0:ax1]
    if ww != w: tile = cv2.resize(tile, (ww, h), interpolation=cv2.INTER_AREA)
    mk = rmask(ww, h, int(radius))
    # sombra
    if border:
        sh = np.zeros((h + 60, ww + 60), np.uint8); sh[30:30 + h, 30:30 + ww] = mk; sh = cv2.GaussianBlur(sh, (0, 0), 14)
        y0, x0 = y - 30 + 14, xo - 30
        ys, xs = max(0, y0), max(0, x0); ye, xe = min(H, y0 + h + 60), min(W, x0 + ww + 60)
        if ye > ys and xe > xs:
            a = (sh[ys - y0:ye - y0, xs - x0:xe - x0, None] / 255.0) * 0.55
            canvas_rgb[ys:ye, xs:xe] = (canvas_rgb[ys:ye, xs:xe] * (1 - a)).astype(np.uint8)
    reg = canvas_rgb[y:y + h, xo:xo + ww]
    if reg.shape[:2] != (h, ww): return
    a = mk[..., None] / 255.0
    reg[:] = (reg * (1 - a) + tile * a).astype(np.uint8)
    if border:
        brd = np.array(Image.fromarray(mk).filter(__import__("PIL.ImageFilter", fromlist=["x"]).MinFilter(border * 2 + 1)))
        ring = (mk > 0) & (brd == 0)
        reg[ring] = CYAN

# ---------- ilustrações ----------
def draw_poly_progress(d, segs, p, col, w, k):
    tot = sum(math.dist(s[0], s[1]) for s in segs); budget = p * tot
    for a, b in segs:
        L = math.dist(a, b)
        if budget <= 0: break
        f = min(1, budget / L); e = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        d.line([(a[0] * k, a[1] * k), (e[0] * k, e[1] * k)], fill=col, width=w * k, joint="curve"); budget -= L

PLAN = [((0, 0), (560, 0)), ((560, 0), (560, 400)), ((560, 400), (0, 400)), ((0, 400), (0, 0)),
        ((220, 0), (220, 150)), ((220, 215), (220, 400)), ((0, 230), (110, 230)), ((170, 230), (220, 230)),
        ((220, 200), (400, 200)), ((460, 200), (560, 200)), ((400, 200), (400, 400))]
def plan_img(p, alpha_fill=0.0):
    def fn(d, k):
        draw_poly_progress(d, PLAN, p, WHITE + (255,), 7, k)
        if p > 0.9:
            for a, b in (((70, 0), (150, 0)), ((300, 0), (380, 0)), ((560, 80), (560, 150))):
                d.line([(a[0] * k, a[1] * k), (b[0] * k, b[1] * k)], fill=CYAN + (255,), width=12 * k)
    return ss(600, 440, fn)

def iso(cx, cy, s):
    return lambda x, y, z: (cx + (x - y) * 0.866 * s, cy + (x + y) * 0.5 * s - z * s)
def house_img(p, pop=1.0):
    Wd, Dp, Hh = 4.0, 3.0, 1.7 * min(1, p / 0.8)
    def fn(d, k):
        P = iso(430, 250, 78 * pop)
        def poly(pts, col, ol=CYAN + (255,)):
            q = [(a * k, b * k) for a, b in [P(*pt) for pt in pts]]; d.polygon(q, fill=col, outline=ol); d.line(q + [q[0]], fill=ol, width=4 * k)
        poly([(0, 0, 0), (Wd, 0, 0), (Wd, Dp, 0), (0, Dp, 0)], (200, 210, 225, 255))
        poly([(Wd, 0, 0), (Wd, Dp, 0), (Wd, Dp, Hh), (Wd, 0, Hh)], (206, 214, 232, 255))
        poly([(0, Dp, 0), (Wd, Dp, 0), (Wd, Dp, Hh), (0, Dp, Hh)], (238, 242, 250, 255))
        if p > 0.55:
            wp = min(1, (p - 0.55) / 0.3)
            for u in (0.18, 0.6):   # janelas face frontal
                u0, u1 = u * Wd, (u + 0.22) * Wd
                poly([(u0, Dp, 0.55), (u1, Dp, 0.55), (u1, Dp, 0.55 + 0.7 * wp), (u0, Dp, 0.55 + 0.7 * wp)], (30, 70, 120, 255))
            poly([(Wd, 0.5, 0.55), (Wd, 1.3, 0.55), (Wd, 1.3, 0.55 + 0.7 * wp), (Wd, 0.5, 0.55 + 0.7 * wp)], (30, 70, 120, 255))
            poly([(Wd, 1.8, 0.0), (Wd, 2.5, 0.0), (Wd, 2.5, 1.2 * wp), (Wd, 1.8, 1.2 * wp)], (190, 130, 70, 255))
        if p > 0.85:
            rp = min(1, (p - 0.85) / 0.15); o = 0.25
            poly([(-o, -o, Hh), (Wd + o, -o, Hh), (Wd + o, Dp + o, Hh), (-o, Dp + o, Hh)], (250, 250, 252, int(255 * rp)))
    return ss(860, 460, fn)

def eye_img(p, t):
    def fn(d, k):
        cx, cy = 150, 100
        for i in range(3):   # ondas
            r = ((t * 0.9 + i / 3) % 1); rr = 55 + r * 85
            d.ellipse(((cx - rr) * k, (cy - rr * .6) * k, (cx + rr) * k, (cy + rr * .6) * k), outline=CYAN + (int(200 * (1 - r)),), width=4 * k)
        op = ease(p)
        d.ellipse(((cx - 95) * k, (cy - 52 * op) * k, (cx + 95) * k, (cy + 52 * op) * k), fill=WHITE + (255,), outline=DARK + (255,), width=6 * k)
        d.ellipse(((cx - 36) * k, (cy - 36 * op) * k, (cx + 36) * k, (cy + 36 * op) * k), fill=CYAN + (255,))
        d.ellipse(((cx - 15) * k, (cy - 15 * op) * k, (cx + 15) * k, (cy + 15 * op) * k), fill=DARK + (255,))
        d.ellipse(((cx + 6) * k, (cy - 20 * op) * k, (cx + 18) * k, (cy - 8 * op) * k), fill=WHITE + (255,))
    return ss(300, 200, fn)

def icon_helmet(d, k, cx, cy, s=1.0):
    d.pieslice(((cx - 70 * s) * k, (cy - 70 * s) * k, (cx + 70 * s) * k, (cy + 70 * s) * k), 180, 360, fill=YEL + (255,), outline=DARK + (255,), width=5 * k)
    d.rounded_rectangle(((cx - 92 * s) * k, (cy - 2 * s) * k, (cx + 92 * s) * k, (cy + 20 * s) * k), 8 * k, fill=YEL + (255,), outline=DARK + (255,), width=5 * k)
    d.rectangle(((cx - 12 * s) * k, (cy - 68 * s) * k, (cx + 12 * s) * k, (cy - 6 * s) * k), fill=(255, 230, 120, 255))
def icon_person(d, k, cx, cy, s=1.0):
    d.ellipse(((cx - 36 * s) * k, (cy - 74 * s) * k, (cx + 36 * s) * k, (cy - 2 * s) * k), fill=CYAN + (255,), outline=DARK + (255,), width=5 * k)
    d.pieslice(((cx - 78 * s) * k, (cy + 10 * s) * k, (cx + 78 * s) * k, (cy + 150 * s) * k), 180, 360, fill=CYAN + (255,), outline=DARK + (255,), width=5 * k)
def icon_shield(d, k, cx, cy, s=1.0):
    pts = [(cx - 62 * s, cy - 70 * s), (cx + 62 * s, cy - 70 * s), (cx + 62 * s, cy + 5 * s), (cx, cy + 78 * s), (cx - 62 * s, cy + 5 * s)]
    d.polygon([(a * k, b * k) for a, b in pts], fill=CYAN + (255,), outline=DARK + (255,)); d.line([(a * k, b * k) for a, b in pts + [pts[0]]], fill=DARK + (255,), width=5 * k)
    d.line([((cx - 28 * s) * k, (cy - 2 * s) * k), ((cx - 6 * s) * k, (cy + 24 * s) * k), ((cx + 32 * s) * k, (cy - 30 * s) * k)], fill=WHITE + (255,), width=12 * k)
def icon_bars(d, k, cx, cy, s=1.0, grow=1.0):
    for i, hh in enumerate((50, 90, 135)):
        h_ = hh * s * grow; x0 = cx - 70 * s + i * 52 * s
        d.rounded_rectangle((x0 * k, (cy + 62 * s - h_) * k, (x0 + 38 * s) * k, (cy + 62 * s) * k), 6 * k, fill=(YEL if i == 2 else CYAN) + (255,), outline=DARK + (255,), width=4 * k)
    d.line([((cx - 80 * s) * k, (cy + 68 * s) * k), ((cx + 84 * s) * k, (cy + 68 * s) * k)], fill=DARK + (255,), width=5 * k)

def icon_card(kind, label, p, t_local):
    w, h = 380, 330
    def fn(d, k):
        d.rounded_rectangle((0, 0, w * k - 1, h * k - 1), 36 * k, fill=WHITE + (250,))
        d.rounded_rectangle((0, 0, w * k - 1, 22 * k), 11 * k, fill=YEL + (255,))
        (icon_helmet if kind == "h" else icon_person)(d, k, w / 2, 125, 1.0)
        # check desenhado
        cp = max(0, (t_local - 0.35) / 0.35)
        if cp > 0:
            cx, cy = w - 58, 62
            d.ellipse(((cx - 34) * k, (cy - 34) * k, (cx + 34) * k, (cy + 34) * k), fill=(40, 200, 120, 255))
            pts = [(cx - 16, cy + 1), (cx - 4, cy + 14), (cx + 18, cy - 14)]
            n = min(2, cp * 2);
            d.line([(pts[0][0] * k, pts[0][1] * k), ((pts[0][0] + (pts[1][0] - pts[0][0]) * min(1, n)) * k, (pts[0][1] + (pts[1][1] - pts[0][1]) * min(1, n)) * k)], fill=WHITE + (255,), width=9 * k)
            if n > 1: d.line([(pts[1][0] * k, pts[1][1] * k), ((pts[1][0] + (pts[2][0] - pts[1][0]) * (n - 1)) * k, (pts[1][1] + (pts[2][1] - pts[1][1]) * (n - 1)) * k)], fill=WHITE + (255,), width=9 * k)
        f = F(50); d.text(((w * k - tw(d, label, f)[0]) // 2, 262 * k), label, font=f, fill=DARK + (255,)) if False else None
    base = ss(w, h, fn)
    im = Image.fromarray(base); d2 = ImageDraw.Draw(im); f = F(46); tww = tw(d2, label, f)[0]
    d2.text(((w - tww) // 2, 255), label, font=f, fill=DARK + (255,))
    return np.array(im)

def pill_img(kind, label, grow):
    f = F(52); d0 = ImageDraw.Draw(canvas(5, 5)); lw = tw(d0, label, f)[0]; w, h = lw + 250, 150
    def fn(d, k):
        d.rounded_rectangle((0, 0, w * k - 1, h * k - 1), 38 * k, fill=WHITE + (250,))
        d.rounded_rectangle((0, 0, 16 * k, h * k - 1), 8 * k, fill=YEL + (255,))
        (icon_shield if kind == "s" else icon_bars)(d, k, 100, 72, 0.78, grow) if kind == "b" else icon_shield(d, k, 100, 72, 0.78)
    im = Image.fromarray(ss(w, h, fn)); ImageDraw.Draw(im).text((190, 42), label, font=f, fill=DARK + (255,)); return np.array(im)

def stamp_img(sc):
    f = F(130); im = canvas(900, 330); d = ImageDraw.Draw(im); t = "PLANTA 2D"; w_, h_ = tw(d, t, f); bx = (900 - w_) // 2 - 40
    d.rounded_rectangle((bx, 50, bx + w_ + 80, 50 + h_ + 70), 14, outline=RED + (255,), width=14, fill=(255, 255, 255, 235))
    d.text((bx + 40, 72), t, font=f, fill=RED + (255,)); im = im.rotate(8, expand=True, resample=Image.BICUBIC)
    if sc != 1: im = im.resize((int(im.width * sc), int(im.height * sc)), Image.BICUBIC)
    return np.array(im)

def chip_img(text, n=None):
    f = F(54); d0 = ImageDraw.Draw(canvas(5, 5)); full = text; txt = full if n is None else full[:n]
    w = tw(d0, full, f)[0] + 110; im = canvas(w, 96); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, 95), 22, fill=CYAN + (255,)); d.ellipse((24, 33, 48, 57), fill=RED + (255,)); d.text((62, 14), txt, font=f, fill=DARK + (255,))
    return np.array(im)

def comment_img(now):
    k = 2; Wb, Hb = 880, 210; im = canvas(Wb * k, Hb * k); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((0, 0, Wb * k - 1, Hb * k - 1), 70 * k, fill=(255, 255, 255, 250))
    d.ellipse((26 * k, 26 * k, 184 * k, 184 * k), fill=CYAN + (255,), outline=DARK + (255,), width=6 * k)
    im.alpha_composite(Image.fromarray(cv2.resize(ICON_D, (64 * k, 100 * k), interpolation=cv2.INTER_AREA)), (73 * k, 55 * k)); d = ImageDraw.Draw(im, "RGBA")
    txt = "Chama no direct"; n = min(len(txt), int(max(0, now) / 0.05))
    sz = 92
    while sz > 40 and d.textlength(txt, font=F(sz * k)) / k > 470: sz -= 2      # o texto inteiro precisa caber antes do botão
    f = F(sz * k); x0 = 210
    d.text((x0 * k, 105 * k), txt[:n], font=f, fill=DARK + (255,), anchor="lm")
    if int(now * 3) % 2 == 0 and n < len(txt):
        cx = x0 + d.textlength(txt[:n] or " ", font=f) / k + 8; d.rectangle((cx * k, 56 * k, (cx + 7) * k, 154 * k), fill=CYAN + (255,))
    done = now > 0.05 * len(txt) + 0.1; on = (not done) or int((now - 0.05 * len(txt)) * 5) % 2 == 0
    d.ellipse((722 * k, 36 * k, 856 * k, 170 * k), fill=(CYAN if (done and on) else (190, 190, 195)) + (255,), outline=DARK + (255,), width=5 * k)
    d.polygon([(760 * k, 150 * k), (760 * k, 56 * k), (836 * k, 103 * k)], fill=DARK + (255,))
    return np.array(im.resize((Wb, Hb), Image.LANCZOS))
def hook_img():
    im = canvas(W, 260); d = ImageDraw.Draw(im); f = F(66)
    for t, bg, y in (("NÃO É SÓ UMA PLANTA", WHITE, 0), ("É EXPERIÊNCIA VISUAL", CYAN, 96)):
        w_, _ = tw(d, t, f); bw = w_ + 70; bar = canvas(bw, 88); bd = ImageDraw.Draw(bar)
        bd.rounded_rectangle((0, 0, bw - 1, 87), 10, fill=bg + (255,)); bd.text((35, 6), t, font=f, fill=DARK + (255,))
        bar = bar.rotate(2.5 if y == 0 else -2.5, expand=True, resample=Image.BICUBIC); im.alpha_composite(bar, ((W - bar.width) // 2, y + 10))
    return np.array(im)
HOOK = hook_img()

capc = {}
MONT = BASE + "fontes/Montserrat.ttf"
def mont(sz, w=800):
    f = ImageFont.truetype(MONT, sz)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
def caption_img(gi, wi):
    if (gi, wi) in capc: return capc[(gi, wi)]
    g = groups[gi]; ws = [x["w"].upper().strip(".,?!") for x in g]; d0 = ImageDraw.Draw(canvas(5, 5)); sz = 66; gap = 30
    while True:
        f = mont(sz); wd = [d0.textlength(t, font=f) for t in ws]; tot = sum(wd) + gap * (len(ws) - 1) + 44
        if tot <= 1000 or sz <= 40: break
        sz -= 4
    im = canvas(W, 200); d = ImageDraw.Draw(im); x = (W - sum(wd) - gap * (len(ws) - 1)) / 2
    for i, t in enumerate(ws):
        if i == wi:
            d.rounded_rectangle((x - 22, 40, x + wd[i] + 22, 138), 24, fill=CYAN + (255,)); d.text((x, 52), t, font=f, fill=DARK + (255,))
        else:
            d.text((x, 52), t, font=f, fill=WHITE + (255,), stroke_width=6, stroke_fill=(0, 0, 0, 255))
        x += wd[i] + gap
    a_ = np.array(im); capc[(gi, wi)] = a_; return a_

def kin_word(text, size, col, sc=1.0):
    f = F(int(size * sc)); sw = int(9 * sc); d0 = ImageDraw.Draw(canvas(5, 5)); w_, h_ = tw(d0, text, f, sw)
    im = canvas(w_ + 40, h_ + 60); d = ImageDraw.Draw(im)
    d.text((26, 18), text, font=f, fill=(0, 0, 0, 200), stroke_width=sw, stroke_fill=(0, 0, 0, 200))
    d.text((16, 8), text, font=f, fill=col + (255,), stroke_width=sw, stroke_fill=(0, 0, 0, 255)); return np.array(im)

# ================= linha do tempo dos efeitos =================
HOOK_S, HOOK_E = 0.35, 2.9
T_PLAN_S = 3.3; T_HOUSE_S = 5.85
T_VISUAL = m(7.36); T_EXP = m(6.8)
T_STAMP = m(17.46) - 0.08
T_HELM, T_PERS = m(18.86) - 0.12, m(19.6) - 0.12
T_SHIELD, T_BARS = m(23.56) - 0.12, m(25.26) - 0.12
T_CMT = m(26.6) - 0.3
T_TAG = m(13.18) - 0.2; T_OUT = 26.35

def at(rgb, img, x, y, a=1.0): blend(rgb, img, int(x), int(y), a)

import importlib.util
_sp = importlib.util.spec_from_file_location("casa", BASE + "casa.py"); casa = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(casa)
def top_chip(text, col, fg, scale=1.0):
    f = F(int(40 * scale)); d0 = ImageDraw.Draw(canvas(5, 5)); w = tw(d0, text, f)[0] + 56
    im = canvas(w, 66); d = ImageDraw.Draw(im); d.rounded_rectangle((0, 0, w - 1, 65), 18, fill=col + (255,)); d.text((28, 8), text, font=f, fill=fg + (255,)); return np.array(im)
def scene_stage_extras(rgb, t):
    if t < 4.2:
        opening_motion(rgb, t); hook_overlay(rgb, t); return
    if t >= 10.74: return
    ill = casa.illustration(t)
    if ill is not None:
        fade = min(1, (t - 4.2) / 0.25); at(rgb, ill, 40, 235, fade)
    # etiqueta de etapa (muda com a fala)
    if t >= 4.2:
        if t < 5.85: txt, col, fg, t0_ = "PLANTA 2D", WHITE, RED, 4.2
        elif t < 6.8: txt, col, fg, t0_ = "MODELO BIM", CYAN, DARK, 5.85
        else: txt, col, fg, t0_ = "EXPERIÊNCIA VISUAL", YEL, DARK, 6.8
        e = ease((t - t0_) / 0.22); im = top_chip(txt, col, fg)
        at(rgb, im, 50, 238 - int((1 - e) * 40), e)
    # olho + ondas quando fala "visual"
    if t >= T_VISUAL - 0.08:
        e = ease((t - (T_VISUAL - 0.08)) / 0.3); ey = eye_img(e, t); sm = cv2.resize(ey, (int(ey.shape[1] * 0.62), int(ey.shape[0] * 0.62)))
        at(rgb, sm, 690, 232, min(1, e * 2))

def worker_img():
    def fn(d, k):
        d.pieslice((36 * k, 168 * k, 264 * k, 420 * k), 180, 360, fill=(40, 100, 170, 255), outline=DARK + (255,), width=6 * k)
        d.polygon([(k * 74, k * 196), (k * 226, k * 196), (k * 246, k * 262), (k * 54, k * 262)], fill=(255, 122, 0, 255), outline=DARK + (255,))
        for yy in (222, 246): d.rectangle((k * 62, k * yy, k * 238, k * (yy + 12)), fill=(232, 232, 238, 255), outline=DARK + (255,), width=3 * k)
        d.rectangle((k * 144, k * 196, k * 156, k * 262), fill=(255, 190, 90, 255))
        d.ellipse((100 * k, 62 * k, 200 * k, 172 * k), fill=(240, 190, 150, 255), outline=DARK + (255,), width=6 * k)
        d.ellipse((128 * k, 108 * k, 138 * k, 120 * k), fill=DARK + (255,)); d.ellipse((162 * k, 108 * k, 172 * k, 120 * k), fill=DARK + (255,))
        d.arc((126 * k, 118 * k, 176 * k, 158 * k), 20, 160, fill=DARK + (255,), width=4 * k)
        d.pieslice((90 * k, 30 * k, 210 * k, 150 * k), 180, 360, fill=YEL + (255,), outline=DARK + (255,), width=6 * k)
        d.rounded_rectangle((78 * k, 86 * k, 222 * k, 104 * k), 8 * k, fill=YEL + (255,), outline=DARK + (255,), width=5 * k)
        d.rectangle((141 * k, 34 * k, 159 * k, 88 * k), fill=(255, 226, 120, 255))
    return ss(300, 260, fn)
def client_img():
    def fn(d, k):
        d.pieslice((36 * k, 168 * k, 264 * k, 420 * k), 180, 360, fill=(34, 46, 84, 255), outline=DARK + (255,), width=6 * k)
        d.polygon([(k * 120, k * 172), (k * 180, k * 172), (k * 150, k * 236)], fill=(245, 245, 250, 255), outline=DARK + (255,))
        d.polygon([(k * 144, k * 188), (k * 156, k * 188), (k * 162, k * 252), (k * 150, k * 262), (k * 138, k * 252)], fill=RED + (255,), outline=DARK + (255,))
        d.ellipse((100 * k, 62 * k, 200 * k, 172 * k), fill=(226, 176, 136, 255), outline=DARK + (255,), width=6 * k)
        d.pieslice((96 * k, 54 * k, 204 * k, 130 * k), 180, 360, fill=(54, 36, 30, 255), outline=DARK + (255,), width=5 * k)
        d.ellipse((128 * k, 110 * k, 138 * k, 122 * k), fill=DARK + (255,)); d.ellipse((162 * k, 110 * k, 172 * k, 122 * k), fill=DARK + (255,))
        d.arc((126 * k, 120 * k, 176 * k, 160 * k), 20, 160, fill=DARK + (255,), width=4 * k)
        d.rounded_rectangle((176 * k, 214 * k, 262 * k, 258 * k), 8 * k, fill=(240, 244, 248, 255), outline=DARK + (255,), width=5 * k)
        d.rectangle((184 * k, 221 * k, 254 * k, 251 * k), fill=CYAN + (255,))
        d.polygon([(k * 219, k * 227), (k * 240, k * 241), (k * 198, k * 241)], fill=WHITE + (255,)); d.rectangle((204 * k, 241 * k, 234 * k, 250 * k), fill=WHITE + (255,))
    return ss(300, 260, fn)
WORKER, CLIENT = worker_img(), client_img()
def label_pill(text):
    f = F(52); d0 = ImageDraw.Draw(canvas(5, 5)); w_ = tw(d0, text, f)[0] + 60; im = canvas(w_, 76); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w_ - 1, 75), 22, fill=WHITE + (255,)); d.rounded_rectangle((0, 0, 14, 75), 7, fill=YEL + (255,)); d.text((34, 8), text, font=f, fill=DARK + (255,)); return np.array(im)
PILL_W, PILL_C = label_pill("MÃO DE OBRA"), label_pill("CLIENTE")
HUB = None
def hub_img():
    k = 2; im = canvas(220 * k, 220 * k); d = ImageDraw.Draw(im, "RGBA")
    d.ellipse((8 * k, 8 * k, 212 * k, 212 * k), fill=(9, 22, 52, 245), outline=CYAN + (255,), width=8 * k)
    ic = Image.fromarray(cv2.resize(ICON, (84 * k, 132 * k), interpolation=cv2.INTER_AREA)); im.alpha_composite(ic, (68 * k, 44 * k))
    return np.array(im.resize((220, 220), Image.LANCZOS))
def bez(p0, p1, p2, n=40):
    ts = np.linspace(0, 1, n)[:, None]; return (1 - ts) ** 2 * np.array(p0) + 2 * (1 - ts) * ts * np.array(p1) + ts ** 2 * np.array(p2)
def arrow_draw(rgb, p0, p1, p2, prog, t):
    if prog <= 0: return
    pts = bez(p0, p1, p2, 48); n = max(2, int(len(pts) * min(1, prog))); seg = pts[:n].astype(np.int32)
    cv2.polylines(rgb, [seg], False, (0, 0, 0), 20, cv2.LINE_AA); cv2.polylines(rgb, [seg], False, CYAN, 12, cv2.LINE_AA)
    for i in range(0, n, 6):   # pontinhos correndo
        j = int((i + t * 30) % n); cv2.circle(rgb, tuple(seg[j]), 6, WHITE, -1)
    if prog >= 0.98:
        e = seg[-1]; d_ = (pts[-1] - pts[-4]); d_ = d_ / (np.linalg.norm(d_) + 1e-6); nrm = np.array([-d_[1], d_[0]])
        tip = pts[-1] + d_ * 22; a1 = pts[-1] + nrm * 30 - d_ * 8; a2 = pts[-1] - nrm * 30 - d_ * 8
        cv2.fillConvexPoly(rgb, np.array([tip, a1, a2], np.int32), (0, 0, 0), cv2.LINE_AA)
        tip2 = pts[-1] + d_ * 16; b1 = pts[-1] + nrm * 22 - d_ * 6; b2 = pts[-1] - nrm * 22 - d_ * 6
        cv2.fillConvexPoly(rgb, np.array([tip2, b1, b2], np.int32), CYAN, cv2.LINE_AA)
T_HUB = 17.05
def scene_s4_extras(rgb, t):   # 15.04 - 19.34: carimbo -> B no centro apontando para as duas frentes
    if t >= T_STAMP and t < T_HUB + 0.6:
        p = (t - T_STAMP) / 0.18
        sc = 1.6 - 0.55 * ease(p) if p < 1 else 1.05 - 0.05 * min(1, (t - T_STAMP - 0.18) / 0.1)
        move = ease((t - (T_HUB - 0.1)) / 0.35); sc *= (1 - 0.45 * move); im = stamp_img(round(sc, 2)); a = min(1, (t - T_STAMP) / 0.08)
        at(rgb, im, (W - im.shape[1]) // 2, 262 + int(-20 * move), a)
    global HUB
    if HUB is None: HUB = hub_img()
    if t >= T_HUB:
        e = back((t - T_HUB) / 0.35); s_ = max(0.05, e); h = cv2.resize(HUB, (int(220 * s_ * 0.8), int(220 * s_ * 0.8)))
        for r_ in range(2):   # ondas
            q = ((t - T_HUB) * 0.9 + r_ * 0.5) % 1.0; ov = rgb.copy(); cv2.circle(ov, (540, 440), int(88 + q * 90), CYAN, 4); cv2.addWeighted(ov, (1 - q) * 0.8, rgb, 1 - (1 - q) * 0.8, 0, rgb)
        at(rgb, h, 540 - h.shape[1] // 2, 440 - h.shape[0] // 2, min(1, (t - T_HUB) / 0.15))
    for (t_in, tx, img, pill, x) in ((T_HELM, 280, WORKER, PILL_W, 290), (T_PERS, 800, CLIENT, PILL_C, 790)):
        a_t0 = t_in - 0.33
        if t >= a_t0:
            pr = ease((t - a_t0) / 0.33); arrow_draw(rgb, (540, 530), (540 + (tx - 540) * 0.25, 640), (tx, 668), pr, t)
        if t >= t_in:
            e = back((t - t_in) / 0.4); sc = max(0.05, e); im2 = cv2.resize(img, (int(img.shape[1] * sc * 0.82), int(img.shape[0] * sc * 0.82)))
            by = 850; at(rgb, im2, x - im2.shape[1] // 2, by - im2.shape[0], min(1, (t - t_in) / 0.15))
            ph = (t - t_in) / 0.5
            if 0 < ph < 1: 
                ov = rgb.copy(); cv2.circle(ov, (x, 720), int(110 + ph * 90), YEL, 6); cv2.addWeighted(ov, 1 - ph, rgb, ph, 0, rgb)
            pe = ease((t - t_in - 0.15) / 0.25)
            if pe > 0: at(rgb, pill, x - pill.shape[1] // 2, 858 - int((1 - pe) * 30), pe)
            ck = (t - t_in - 0.35) / 0.25
            if ck > 0:
                cx, cy = x + 98, 700; cv2.circle(rgb, (cx, cy), 36, (40, 200, 120), -1); cv2.circle(rgb, (cx, cy), 36, DARK, 4)
                pts = np.array([[cx - 16, cy + 2], [cx - 4, cy + 15], [cx + 18, cy - 14]], np.int32); n = min(1.0, ck)
                cv2.polylines(rgb, [pts[:2 if n < 0.5 else 3]], False, WHITE, 8, cv2.LINE_AA)

def scene_s3_extras(rgb, t):   # 10.74 - 15.04: visor
    tl = t - 10.74; a = min(1, tl / 0.3)
    mg, L = 100, 90
    for (cx, cy, sx, sy) in ((mg, 250, 1, 1), (W - mg, 250, -1, 1), (mg, 1530, 1, -1), (W - mg, 1530, -1, -1)):
        pulse = int(6 + 2 * math.sin(tl * 5))
        cv2.line(rgb, (cx, cy), (cx + sx * L, cy), WHITE, pulse); cv2.line(rgb, (cx, cy), (cx, cy + sy * L), WHITE, pulse)
    # linha de varredura
    y = int(250 + ((tl * 0.6) % 1) * 1280); ov = rgb.copy(); cv2.rectangle(ov, (mg, y - 6), (W - mg, y + 6), CYAN, -1)
    rgb[:] = cv2.addWeighted(ov, 0.4, rgb, 0.6, 0)
    if t >= T_TAG:
        n = int((t - T_TAG) / 0.05); im = chip_img("MELHOR EXPERIÊNCIA VISUAL", n); e = ease((t - T_TAG) / 0.3)
        at(rgb, im, 130 + int((1 - e) * -500), 300, 1.0)

def scene_s5_extras(rgb, t):   # 19.34 - 24.08
    for tt, kind, lab, y in ((T_SHIELD, "s", "SEGURANÇA FÍSICA", 300), (T_BARS, "b", "SEGURANÇA ORÇAMENTÁRIA", 480)):
        if t >= tt and t < 24.0:
            e = back((t - tt) / 0.4); im = pill_img(kind, lab, ease((t - tt) / 0.5))
            x = int(lerp(W + 50, (W - im.shape[1]) // 2, min(1, e))); out = max(0, (t - 23.8) / 0.2)
            at(rgb, im, x + int(out * 600), y, 1.0)

def outro(rgb, t):
    if t < T_OUT: return
    tl = t - T_OUT; k = 2
    # cantoneiras de planta
    pe = ease(tl / 0.5); L = int(150 * pe)
    for (cx, cy, sx, sy) in ((70, 440, 1, 1), (W - 70, 440, -1, 1), (70, 1215, 1, -1), (W - 70, 1215, -1, -1)):
        cv2.line(rgb, (cx, cy), (cx + sx * L, cy), CYAN, 6); cv2.line(rgb, (cx, cy), (cx, cy + sy * L), CYAN, 6)
    # LOGO OFICIAL (revela da esquerda para a direita)
    if tl > 0.05:
        p = ease((tl - 0.05) / 0.75); sc = 0.93 + 0.07 * min(1.0, back((tl - 0.05) / 0.6)); w0 = int(880 * sc); h0 = int(LOGO_W.shape[0] * w0 / LOGO_W.shape[1])
        lg = cv2.resize(LOGO_W, (w0, h0), interpolation=cv2.INTER_AREA).copy()
        xs = np.arange(w0)[None, :]; edge = p * (w0 + 120); fade = np.clip((edge - xs) / 120.0, 0, 1)
        lg[..., 3] = (lg[..., 3] * fade).astype(np.uint8)
        glow = lg.copy(); glow[..., 0], glow[..., 1], glow[..., 2] = CYAN; glow = cv2.GaussianBlur(glow, (0, 0), 14)
        x0 = (W - w0) // 2; y0 = 690 - h0 // 2
        blend(rgb, glow, x0, y0, 0.55); blend(rgb, lg, x0, y0, 1.0)
    # chamada
    if tl > 1.0:
        e3 = back((tl - 1.0) / 0.35); f = F(70); txt = "CHAMA NO DIRECT"; d0 = ImageDraw.Draw(canvas(5, 5)); w_, h_ = tw(d0, txt, f)
        bw = w_ + 200; img = canvas(bw, 120); d = ImageDraw.Draw(img); d.rounded_rectangle((0, 0, bw - 1, 119), 60, fill=WHITE + (255,))
        d.text((38, 22), txt, font=f, fill=DARK + (255,)); d.ellipse((bw - 112, 12, bw - 12, 108), fill=CYAN + (255,))
        d.polygon([(bw - 92, 60), (bw - 32, 34), (bw - 50, 60), (bw - 32, 86)], fill=DARK + (255,))
        sc = max(0.05, e3) * (1 + 0.035 * math.sin(tl * 8)); im2 = cv2.resize(np.array(img), (int(bw * sc), int(120 * sc)))
        pulse = (tl * 1.2) % 1; ov = np.zeros((H, W, 3), np.uint8)
        cv2.ellipse(rgb, (W // 2, 1130), (int(bw / 2 * sc + 18 + pulse * 50), int(60 * sc + 12 + pulse * 40)), 0, 0, 360, YEL, 3) if pulse < 0.9 else None
        at(rgb, im2, (W - im2.shape[1]) // 2, 1130 - im2.shape[0] // 2, 1.0)

def scene_s6_extras(rgb, t):
    if t >= T_CMT:
        p = (t - T_CMT) / 0.35; im = comment_img(t - T_CMT - 0.3)
        fo = 1 - ease((t - T_OUT) / 0.3) if t > T_OUT else 1
        at(rgb, im, (W - im.shape[1]) // 2, 520 + int((1 - ease(p)) * 80) - int((1 - fo) * 60), min(1, p) * fo)
        ts = T_CMT + 0.3 + 0.05 * 15 + 0.15
        if t >= ts:   # confete saindo do botão
            q = (t - ts) / 0.7
            if q < 1:
                for i in range(22):
                    ang = i / 22 * 6.283; r = 40 + 260 * ease(q)
                    cx, cy = int(540 + 340 + math.cos(ang) * r * 0.9 - 340), int(280 + 85 + math.sin(ang) * r)
                    col = YEL if i % 2 else CYAN
                    cv2.circle(rgb, (min(W - 1, max(0, int(890 + math.cos(ang) * r))), min(H - 1, max(0, int(622 + math.sin(ang) * r)))), max(1, int(9 * (1 - q))), col, -1)

def zoom_(fr, z, cx, cy):
    if abs(z - 1) < 1e-3: return fr
    M = np.float32([[z, 0, cx - z * cx], [0, z, cy - z * cy]]); return cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
_yy, _xx = np.mgrid[0:H, 0:W]
def tape(rgb, t):
    """fita zebrada de obra varrendo a tela"""
    for (ang, y0, dly, sp) in ((-12, 620, 0.0, 1.0), (10, 1180, 0.08, 1.0)):
        p = (t - dly) / 0.5
        if p < 0 or p > 1: continue
        cx = -400 + ease(p) * (W + 800); ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        u = (_xx - cx) * ca + (_yy - y0) * sa; v = -(_xx - cx) * sa + (_yy - y0) * ca
        mask = (np.abs(v) < 70) & (u < 0) & (u > -1500)
        if not mask.any(): continue
        st = (((u + v) // 46).astype(np.int32) % 2) == 0
        col = np.where(st[..., None], np.array(YEL, np.uint8), np.array((24, 24, 28), np.uint8)).astype(np.uint8)
        rgb[mask] = col[mask]
        edge = mask & ((np.abs(v) > 62)); rgb[edge] = (24, 24, 28)
    return rgb
ICON = np.array(Image.open(BASE + "logos/icon_white.png")); LOGO_W = np.array(Image.open(BASE + "logos/word_white.png"))
def _plate(h):
    w = int(ICON.shape[1] * (h - 40) / ICON.shape[0]) + 70
    pl = canvas(w, h + 0); d = ImageDraw.Draw(pl); d.rounded_rectangle((0, 0, w - 1, h - 1), 26, fill=(9, 22, 52, 215), outline=CYAN + (255,), width=4)
    ic = cv2.resize(ICON, (w - 70, h - 40), interpolation=cv2.INTER_AREA); pl = np.array(pl); reg = pl[20:20 + h - 40, 35:35 + w - 70]
    a_ = ic[..., 3:4].astype(np.float32) / 255; reg[..., :3] = (reg[..., :3] * (1 - a_) + ic[..., :3] * a_).astype(np.uint8); reg[..., 3] = np.maximum(reg[..., 3], ic[..., 3]); return pl
PLATE = _plate(190)
def brand_tag(rgb, t):
    return
    if 0.08 <= t <= 0.62:
        e = ease((t - 0.08) / 0.3); q = ease((0.62 - t) / 0.12) if t > 0.5 else 1
        blend(rgb, PLATE, (W - PLATE.shape[1]) // 2, 236 - int((1 - e) * 50), e * q)

def motion_card(kind, label, tl):
    k = 2; Wc, Hc = 900, 300; im = canvas(Wc * k, Hc * k); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((0, 0, Wc * k - 1, Hc * k - 1), 44 * k, fill=(255, 255, 255, 246)); d.rounded_rectangle((0, 0, 20 * k, Hc * k - 1), 10 * k, fill=YEL + (255,))
    cx, cy = 170, 150
    def L(*pts, col=DARK, w=8): d.line([(x * k, y * k) for x, y in pts], fill=col + (255,), width=int(w * k), joint="curve")
    if kind == "compass":
        d.ellipse(((cx - 108) * k, (cy - 108) * k, (cx + 108) * k, (cy + 108) * k), fill=(232, 244, 250, 255), outline=DARK + (255,), width=9 * k)
        d.ellipse(((cx - 90) * k, (cy - 90) * k, (cx + 90) * k, (cy + 90) * k), outline=CYAN + (255,), width=4 * k)
        for i in range(24):
            a = math.radians(i * 15); r0 = 76 if i % 6 == 0 else 84
            L((cx + math.sin(a) * r0, cy - math.cos(a) * r0), (cx + math.sin(a) * 92, cy - math.cos(a) * 92), w=4 if i % 6 else 6)
        d.text(((cx - 11) * k, (cy - 86) * k + 6 * k), "N", font=F(34 * k), fill=RED + (255,))
        lock = 0.74
        if tl < lock: th = (1 - easeio(tl / lock)) * (3 * 360 + 40)
        else: th = 14 * math.sin((tl - lock) * 20) * math.exp(-(tl - lock) * 5)
        a = math.radians(th)
        def rot(x, y): return (cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a))
        d.polygon([(x * k, y * k) for x, y in (rot(0, -68), rot(15, 0), rot(-15, 0))], fill=RED + (255,))
        d.polygon([(x * k, y * k) for x, y in (rot(0, 68), rot(15, 0), rot(-15, 0))], fill=(70, 74, 86, 255))
        d.ellipse(((cx - 9) * k, (cy - 9) * k, (cx + 9) * k, (cy + 9) * k), fill=WHITE + (255,), outline=DARK + (255,), width=3 * k)
        if tl > lock:   # trava no norte
            pr = (tl - lock) / 0.5
            if pr < 1: d.ellipse(((cx - 110 - 50 * pr) * k, (cy - 110 - 50 * pr) * k, (cx + 110 + 50 * pr) * k, (cy + 110 + 50 * pr) * k), outline=YEL + (int(220 * (1 - pr)),), width=5 * k)
    elif kind == "shield":
        pts = [(-78, -88), (78, -88), (78, 8), (0, 98), (-78, 8), (-78, -88)]; p = min(1, tl / 0.7)
        tot = sum(math.dist(pts[i], pts[i + 1]) for i in range(5)); bud = p * tot; cur = []
        for i in range(5):
            Ls = math.dist(pts[i], pts[i + 1])
            if bud <= 0: break
            f = min(1, bud / Ls); bud -= Ls
            L((cx + pts[i][0], cy + pts[i][1]), (cx + pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, cy + pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f), w=9)
        if tl > 0.6:
            fa = min(1, (tl - 0.6) / 0.3); d.polygon([((cx + x) * k, (cy + y) * k) for x, y in pts[:5]], fill=CYAN + (int(255 * fa),)); L(*[(cx + x, cy + y) for x, y in pts], w=9)
        cp = (tl - 0.75) / 0.4
        if cp > 0:
            n = min(2, cp * 2); a_, b_, c_ = (cx - 32, cy - 2), (cx - 8, cy + 28), (cx + 38, cy - 38)
            L(a_, (a_[0] + (b_[0] - a_[0]) * min(1, n), a_[1] + (b_[1] - a_[1]) * min(1, n)), col=WHITE, w=15)
            if n > 1: L(b_, (b_[0] + (c_[0] - b_[0]) * (n - 1), b_[1] + (c_[1] - b_[1]) * (n - 1)), col=WHITE, w=15)
        rp = (tl - 1.0) / 0.5
        if 0 < rp < 1: d.ellipse(((cx - 90 - 60 * rp) * k, (cy - 90 - 60 * rp) * k, (cx + 90 + 60 * rp) * k, (cy + 90 + 60 * rp) * k), outline=CYAN + (int(220 * (1 - rp)),), width=5 * k)
    else:
        hs = (62, 98, 136, 176)
        for i, h_ in enumerate(hs):
            pe = ease((tl - 0.14 * i) / 0.45); hh = h_ * pe; x0 = cx - 100 + i * 52
            if hh > 1: d.rounded_rectangle((x0 * k, (cy + 92 - hh) * k, (x0 + 38) * k, (cy + 92) * k), 7 * k, fill=(YEL if i == 3 else CYAN) + (255,), outline=DARK + (255,), width=4 * k)
        L((cx - 112, cy + 98), (cx + 112, cy + 98), w=6)
        ap = ease((tl - 0.75) / 0.5)
        if ap > 0:
            x1, y1, x2, y2 = cx - 98, cy + 30, cx + 98, cy - 100; xe, ye = x1 + (x2 - x1) * ap, y1 + (y2 - y1) * ap
            L((x1, y1), (xe, ye), col=RED, w=9)
            if ap > 0.98: d.polygon([((x2 + 16) * k, (y2 - 16) * k), ((x2 - 26) * k, (y2 - 4) * k), ((x2 - 4) * k, (y2 + 26) * k)], fill=RED + (255,))
    # texto revelado da esquerda para a direita
    f = F(int((64 if len(label) < 20 else 52) * k)); ti = canvas(Wc * k, Hc * k); td = ImageDraw.Draw(ti)
    th_ = td.textbbox((0, 0), label, font=f)[3]; td.text((330 * k, (Hc * k - th_) // 2 - 6 * k), label, font=f, fill=DARK + (255,))
    a = np.array(ti); cut = int((330 * k) + (Wc * k - 330 * k) * ease((tl - 0.2) / 0.5)); a[:, cut:] = 0
    im = Image.alpha_composite(im, Image.fromarray(a))
    return np.array(im.resize((Wc, Hc), Image.LANCZOS))
MOTION = [("compass", "NORTEAR A OBRA", 19.6, 330), ("shield", "SEGURANÇA FÍSICA", 21.62, 660), ("bars", "SEGURANÇA ORÇAMENTÁRIA", 23.32, 990)]
def motion_scene(rgb, t):
    for kind, lab, ts, y in MOTION:
        tl = t - ts
        if tl < 0: continue
        e = back(tl / 0.4); x = int(lerp(W + 40, 90, min(1.25, e))); out = max(0.0, (t - 23.85) / 0.2)
        im = motion_card(kind, lab, tl); at(rgb, im, x + int(out * 700), y, min(1, tl / 0.15))

ICON_D = ICON.copy(); ICON_D[..., 0], ICON_D[..., 1], ICON_D[..., 2] = DARK
def _wm(h=84):
    w = int(ICON.shape[1] * h / ICON.shape[0]); ic = cv2.resize(ICON, (w, h), interpolation=cv2.INTER_AREA).copy()
    sh = ic.copy(); sh[..., :3] = 0; sh = cv2.GaussianBlur(sh, (0, 0), 3); a_ = ic[..., 3:4].astype(np.float32) / 255
    out = sh.copy(); out[..., :3] = (sh[..., :3] * (1 - a_) + ic[..., :3] * a_).astype(np.uint8); out[..., 3] = np.maximum((sh[..., 3] * 0.85).astype(np.uint8), ic[..., 3]); return out
WM = _wm()

def _cube(d, k, cx, cy, r=46):
    P_ = lambda x, y: ((cx + x) * k, (cy + y) * k)
    d.polygon([P_(0, -r), P_(r * .87, -r * .5), P_(0, 0), P_(-r * .87, -r * .5)], fill=(250, 250, 252, 255), outline=DARK + (255,))
    d.polygon([P_(-r * .87, -r * .5), P_(0, 0), P_(0, r), P_(-r * .87, r * .5)], fill=(150, 205, 235, 255), outline=DARK + (255,))
    d.polygon([P_(r * .87, -r * .5), P_(0, 0), P_(0, r), P_(r * .87, r * .5)], fill=CYAN + (255,), outline=DARK + (255,))
def steps_img(tl, t):
    k = 2; im = canvas(1000 * k, 700 * k); d = ImageDraw.Draw(im, "RGBA"); base = 690
    blocks = [(100, 360, 480, (235, 242, 250), ["PLANTA"], 0.0), (370, 630, 360, CYAN, ["MODELO"], 0.3), (640, 900, 240, YEL, ["EXPERIÊNCIA", "VISUAL"], 0.62)]
    tops = []
    for bi, (x0, x1, top, col, lab, dl) in enumerate(blocks):
        p = back((tl - dl) / 0.35)
        tops.append(((x0 + x1) // 2, top))
        if p <= 0: continue
        h = (base - top) * min(1.12, max(0.02, p)); y0 = base - h
        d.rounded_rectangle((x0 * k, y0 * k, x1 * k, base * k), 18 * k, fill=col + (255,), outline=DARK + (255,), width=6 * k)
        if p >= 0.9:
            for li, ln in enumerate(lab):
                f = F((48 if len(ln) < 9 else 40) * k); w_ = d.textlength(ln, font=f); d.text((((x0 + x1) // 2) * k - w_ / 2, (y0 + 24 + li * 52) * k), ln, font=f, fill=DARK + (255,))
        ip = back((tl - dl - 0.25) / 0.3); cx = (x0 + x1) // 2
        if ip > 0:
            sc = max(0.05, ip); cy = top - 78
            if bi == 0:
                w_, h_ = 120 * sc, 86 * sc; d.rounded_rectangle(((cx - w_ / 2) * k, (cy - h_ / 2) * k, (cx + w_ / 2) * k, (cy + h_ / 2) * k), 8 * k, fill=(247, 244, 237, 255), outline=DARK + (255,), width=5 * k)
                for (xa, ya, xb, yb) in ((.1, .15, .9, .15), (.9, .15, .9, .85), (.9, .85, .1, .85), (.1, .85, .1, .15), (.5, .15, .5, .6), (.1, .6, .7, .6)):
                    d.line(((cx - w_ / 2 + xa * w_) * k, (cy - h_ / 2 + ya * h_) * k, (cx - w_ / 2 + xb * w_) * k, (cy - h_ / 2 + yb * h_) * k), fill=DARK + (255,), width=3 * k)
            elif bi == 1: _cube(d, k, cx, cy + 6, 52 * sc)
            else:
                ex, ey = cx, cy; rx, ry = 64 * sc, 40 * sc * min(1, 0.4 + 0.6 * abs(math.sin(t * 2.2)))
                d.ellipse(((ex - rx) * k, (ey - ry) * k, (ex + rx) * k, (ey + ry) * k), fill=WHITE + (255,), outline=DARK + (255,), width=6 * k)
                d.ellipse(((ex - 24 * sc) * k, (ey - 24 * sc) * k, (ex + 24 * sc) * k, (ey + 24 * sc) * k), fill=CYAN + (255,)); d.ellipse(((ex - 10 * sc) * k, (ey - 10 * sc) * k, (ex + 10 * sc) * k, (ey + 10 * sc) * k), fill=DARK + (255,))
    # seta "vai muito além"
    ap = ease((tl - 1.0) / 0.55)
    if ap > 0:
        pts = [(230, 440), (500, 318), (770, 196), (930, 40)]
        tot = sum(math.dist(pts[i], pts[i + 1]) for i in range(3)); bud = ap * tot; cur = pts[0]
        for i in range(3):
            Ls = math.dist(pts[i], pts[i + 1])
            if bud <= 0: break
            f_ = min(1, bud / Ls); bud -= Ls; nxt = (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f_, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f_)
            d.line([(pts[i][0] * k, pts[i][1] * k), (nxt[0] * k, nxt[1] * k)], fill=(0, 0, 0, 255), width=24 * k); d.line([(pts[i][0] * k, pts[i][1] * k), (nxt[0] * k, nxt[1] * k)], fill=RED + (255,), width=14 * k); cur = nxt
        if ap >= 0.98:
            ex, ey = pts[-1]; d.polygon([((ex + 34) * k, (ey - 42) * k), ((ex - 36) * k, (ey - 4) * k), ((ex + 8) * k, (ey + 30) * k)], fill=RED + (255,), outline=(0, 0, 0, 255))
            for (sx, sy, sr, ph) in ((880, 100, 26, 0), (960, 150, 18, 1), (820, 40, 16, 2)):
                q = 0.5 + 0.5 * math.sin(t * 10 + ph); r_ = sr * (0.5 + q)
                d.polygon([((sx) * k, (sy - r_) * k), ((sx + r_ * .25) * k, (sy - r_ * .25) * k), ((sx + r_) * k, sy * k), ((sx + r_ * .25) * k, (sy + r_ * .25) * k), (sx * k, (sy + r_) * k), ((sx - r_ * .25) * k, (sy + r_ * .25) * k), ((sx - r_) * k, sy * k), ((sx - r_ * .25) * k, (sy - r_ * .25) * k)], fill=(255, 255, 255, 235))
    return np.array(im.resize((1000, 700), Image.LANCZOS))
def scene_s3_motion(rgb, t):
    if t < 10.74: return
    # palavras grandes (melhor experiência visual)
    out_p = ease((t - 13.1) / 0.3) if t > 13.1 else 0.0
    if out_p < 1:
        for (txt, size, col, ts, y) in (("MELHOR", 150, YEL, 11.3, 270), ("EXPERIÊNCIA", 112, WHITE, 11.7, 440), ("VISUAL", 170, CYAN, 12.25, 560)):
            e = back((t - ts) / 0.3)
            if t < ts: continue
            im = kin_word(txt, size, col, max(0.3, 0.7 + 0.3 * min(1.2, e)))
            dx = int(8 * math.sin(t * 80)) if 0 < t - ts < 0.12 else 0
            at(rgb, im, (W - im.shape[1]) // 2 + dx, y - int(out_p * 60), min(1, (t - ts) / 0.1) * (1 - out_p))
        if t >= 12.3:
            ey = eye_img(ease((t - 12.3) / 0.3), t); sm = cv2.resize(ey, (int(ey.shape[1] * 0.55), int(ey.shape[0] * 0.55))); at(rgb, sm, 720, 585, (1 - out_p))
    if t >= 13.1:
        e = ease((t - 13.1) / 0.25); ch = top_chip("MELHOR EXPERIÊNCIA VISUAL", YEL, DARK); at(rgb, ch, 50, 238 - int((1 - e) * 40), e)
        st = steps_img(t - 13.2, t); at(rgb, st, 40, 240, min(1, (t - 13.2) / 0.15))

def draw_caption(rgb, t, y):
    for gi, g in enumerate(groups):
        if g[0]["s"] - 0.02 <= t < g[-1]["e"] + 0.12:
            wi = 0
            for i, x in enumerate(g):
                if t >= x["s"] - 0.02: wi = i
            img = caption_img(gi, wi); p = (t - g[0]["s"]) / 0.1
            if 0 <= p < 1: img = cv2.warpAffine(img, cv2.getRotationMatrix2D((W / 2, 100), 0, 1.12 - 0.12 * ease(p)), (W, 200))
            blend(rgb, img, 0, y); break


# ================= NOVA ABERTURA =================
def warp_(fr, z, cx, cy, dy):
    M = np.float32([[z, 0, cx - z * cx], [0, z, cy - z * cy + dy]])
    return cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
_TZH = 620
_tz = np.zeros((_TZH, W, 4), np.uint8); _ya = np.clip(1 - np.arange(_TZH)[:, None] / float(_TZH), 0, 1) ** 1.1
_tz[..., 0], _tz[..., 1], _tz[..., 2] = 9, 22, 52; _tz[..., 3] = (np.repeat(_ya, W, axis=1) * 0.82 * 255).astype(np.uint8)
for _gy in range(0, _TZH, 60):
    _tz[_gy, :, 0], _tz[_gy, :, 1], _tz[_gy, :, 2] = CYAN; _tz[_gy, :, 3] = np.maximum(_tz[_gy, :, 3], int(_ya[_gy, 0] * 0.4 * 255))
for _gx in range(0, W, 60):
    _tz[:, _gx, 0], _tz[:, _gx, 1], _tz[:, _gx, 2] = CYAN; _tz[:, _gx, 3] = np.maximum(_tz[:, _gx, 3], (_ya[:, 0] * 0.4 * 255).astype(np.uint8))
def hook_bar(text, bg, fg, strike=0.0, rot=0.0):
    f = F(72); d0 = ImageDraw.Draw(canvas(5, 5)); w_, _ = tw(d0, text, f); bw = w_ + 84
    bar = canvas(bw, 100); bd = ImageDraw.Draw(bar); bd.rounded_rectangle((0, 0, bw - 1, 99), 14, fill=bg + (255,)); bd.text((42, 6), text, font=f, fill=fg + (255,))
    if strike > 0:
        x0 = 42 + tw(bd, "NÃO É", f)[0] + 24; x1 = 42 + w_; xe = x0 + (x1 - x0) * ease(strike)
        bd.line([(x0 - 8, 54), (xe, 54)], fill=RED + (255,), width=12)
    if rot: bar = bar.rotate(rot, expand=True, resample=Image.BICUBIC)
    return np.array(bar)
NAME, CARGO = "Rogério Otávio", "Engenheiro Civil"
def id_plate():
    k = 2; w, h = 940, 170; im = canvas(w * k, h * k); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((0, 0, w * k - 1, h * k - 1), 26 * k, fill=(9, 22, 52, 228)); d.rounded_rectangle((0, 0, 18 * k, h * k - 1), 9 * k, fill=CYAN + (255,))
    lw = 330 if NAME else 520; lh = int(LOGO_W.shape[0] * lw / LOGO_W.shape[1])
    lg = Image.fromarray(cv2.resize(LOGO_W, (lw * k, lh * k), interpolation=cv2.INTER_AREA))
    lx = 60 if NAME else (w - lw) // 2 + 8
    im.alpha_composite(lg, (lx * k, ((h - lh) // 2) * k))
    if NAME:
        d.rounded_rectangle((418 * k, 30 * k, 422 * k, 140 * k), 2 * k, fill=(255, 255, 255, 120))
        d.text((450 * k, 26 * k), NAME.upper(), font=F(64 * k), fill=WHITE + (255,)); d.text((452 * k, 104 * k), CARGO.upper(), font=F(38 * k), fill=CYAN + (255,))
    return np.array(im.resize((w, h), Image.LANCZOS))
PLATE_ID = cv2.resize(id_plate(), (846, 153), interpolation=cv2.INTER_AREA)
def opening_frame(rgbs, t):
    out = warp_(rgbs, 1 + 0.035 * (1 - ease(t / 0.8)), 540, 693, 0)
    if t < 0.35:
        k = int(1 + 10 * (1 - t / 0.35)) | 1; out = cv2.GaussianBlur(out, (k, k), 0)
    if 0.2 <= t < T_SHRINK:
        e = back((t - 0.2) / 0.4); ex = ease((t - 1.45) / 0.28) if t > 1.45 else 0.0
        dx = int(lerp(-1000, 117, min(1.2, e))) - int(ex * 1100)
        blend(out, PLATE_ID, dx, 262, min(1, (t - 0.2) / 0.1))
    draw_caption(out, t, 1100)
    return out

# ---------- motion de abertura: "não é só uma planta, é experiência visual" ----------
def _make_sky(w=760, h=500):
    t = np.linspace(0, 1, h)
    cols = [np.interp(t, [0, 0.55, 0.85, 1], c) for c in ([24, 92, 250, 255], [62, 150, 176, 196], [132, 224, 118, 120])]
    img = np.stack([np.repeat(c[:, None], w, axis=1) for c in cols], axis=2).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]; dist = np.sqrt((xx - 0.74 * w) ** 2 + (yy - 0.50 * h) ** 2)
    img += (np.exp(-(dist / (0.16 * w)) ** 2)[..., None] * np.array((255, 215, 140)) * 0.9)
    cl = np.zeros((h, w), np.float32)
    for (cx, cy, rx, ry) in ((140, 90, 90, 22), (210, 112, 70, 16), (520, 70, 100, 20), (440, 130, 60, 14), (640, 160, 70, 15)):
        cv2.ellipse(cl, (cx, cy), (rx, ry), 0, 0, 360, 1.0, -1)
    cl = cv2.GaussianBlur(cl, (0, 0), 9); img = img * (1 - cl[..., None] * 0.55) + 255 * cl[..., None] * 0.55
    return np.clip(img, 0, 255).astype(np.uint8)
SKY = _make_sky()
def rmask_(w, h, r):
    m_ = Image.new("L", (w, h), 0); ImageDraw.Draw(m_).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return np.array(m_)
HMASK = rmask_(760, 500, 40)
HRING = (HMASK > 0) & (cv2.erode(HMASK, np.ones((9, 9), np.uint8)) == 0)
def star(img, cx, cy, r, col, a):
    pts = np.array([[cx, cy - r], [cx + r * 0.22, cy - r * 0.22], [cx + r, cy], [cx + r * 0.22, cy + r * 0.22], [cx, cy + r], [cx - r * 0.22, cy + r * 0.22], [cx - r, cy], [cx - r * 0.22, cy - r * 0.22]], np.int32)
    ov = img.copy(); cv2.fillPoly(ov, [pts], col); cv2.addWeighted(ov, a, img, 1 - a, 0, img)
def hero_frame(tl, t):
    """cartão com o cenário de render (céu + casa girando)"""
    sky = SKY.copy()
    r3, _ = casa.render3d(10.0 + tl * 4.2)
    reg = r3[95:595, 125:885].copy()                       # recorte maior: casa em destaque
    # luz quente e cores mais vivas na casa
    hsv = cv2.cvtColor(reg[..., :3], cv2.COLOR_RGB2HSV).astype(np.float32); hsv[..., 1] = np.clip(hsv[..., 1] * 1.35, 0, 255); hsv[..., 2] = np.clip(hsv[..., 2] * 1.06, 0, 255)
    col = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32); col[..., 0] *= 1.07; col[..., 2] *= 0.94
    reg[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    al = reg[..., 3:4].astype(np.float32) / 255; sky = (sky * (1 - al) + reg[..., :3] * al).astype(np.uint8)
    for (x, y, r, ph) in ((600, 120, 26, 0.0), (180, 150, 18, 1.1), (690, 300, 20, 2.0), (90, 330, 14, 0.6), (420, 60, 16, 1.7)):
        q = 0.5 + 0.5 * math.sin(tl * 9 + ph); star(sky, x, y, int(r * (0.4 + q)), (255, 255, 255), 0.55 + 0.4 * q)
    sky = sky.copy(); sky[HRING] = CYAN
    return sky
def ink_sheet(tl):
    """folha de papel com a planta em preto (estilo desenho de papel)"""
    pl = casa.plan_cad(tl)
    paper = np.zeros((705, 1000, 4), np.uint8); paper[..., :3] = (246, 243, 236); paper[..., 3] = 0
    mk = rmask_(900, 640, 22); paper[32:672, 50:950, 3] = mk
    paper[..., 3] = np.where(paper[..., 3] > 0, 255, 0)
    ink = pl.copy(); ink[..., :3] = (38, 42, 56); ink[..., 3] = np.clip(pl[..., 3].astype(np.int32) * 1.15, 0, 255).astype(np.uint8)
    al = ink[..., 3:4].astype(np.float32) / 255; paper[..., :3] = (paper[..., :3] * (1 - al) + ink[..., :3] * al).astype(np.uint8)
    return paper
def person_img(col):
    def fn(d, k):
        d.ellipse((46 * k, 6 * k, 114 * k, 74 * k), fill=col + (255,), outline=DARK + (255,), width=6 * k)
        d.pieslice((6 * k, 70 * k, 154 * k, 230 * k), 180, 360, fill=col + (255,), outline=DARK + (255,), width=6 * k)
    return ss(160, 120, fn)
PEOPLE = {c_: person_img(c_) for c_ in (CYAN, WHITE, YEL)}
CLOUD = [(-262, 12, 92), (-176, -52, 108), (-44, -86, 118), (96, -72, 114), (220, -30, 104), (268, 36, 84), (150, 74, 98), (0, 88, 98), (-140, 72, 88)]
def bubble_frame(t):
    k = 2; Wr, Hr = 1000, 520; im = canvas(Wr * k, Hr * k); d = ImageDraw.Draw(im, "RGBA")
    cx0, cy0 = 500, 190
    shake = int(10 * math.sin(t * 70)) if 3.62 <= t < 3.98 else 0
    pb = back((t - 2.45) / 0.4); burst = (t - 3.98) / 0.3
    if pb > 0 and burst < 1:
        s_ = max(0.05, pb); ba = 1.0 if burst < 0 else 1 - ease(burst * 3)
        def C(x, y, r, col, w=0):
            X, Y, R = (cx0 + x * s_ + shake) * k, (cy0 + y * s_) * k, r * s_ * k
            d.ellipse((X - R, Y - R, X + R, Y + R), fill=col)
        for (x, y, r) in CLOUD: C(x, y, r + 7, DARK + (int(255 * ba),))
        for (x, y, r) in ((-70, 232, 26), (-96, 290, 17), (-112, 332, 10)): C(x, y, r + 6, DARK + (int(255 * ba),))
        for (x, y, r) in CLOUD: C(x, y, r, (255, 255, 255, int(250 * ba)))
        for (x, y, r) in ((-70, 232, 26), (-96, 290, 17), (-112, 332, 10)): C(x, y, r, (255, 255, 255, int(250 * ba)))
        if pb >= 0.95:
            # "PROJETO" (digitando)
            f = F(96 * k)
            if t >= 2.65:
                tx = "PROJETO"[:max(1, int((t - 2.65) / 0.07))]; d.text(((cx0 - 335 + shake) * k, (cy0 - 66) * k), tx, font=f, fill=DARK + (int(255 * ba),))
            if t >= 2.95:
                e = back((t - 2.95) / 0.3); fs = F(int(150 * k * max(0.2, e)))
                d.text(((cx0 - 5 + shake) * k, (cy0 - 108) * k), "=", font=fs, fill=YEL + (int(255 * ba),), stroke_width=4 * k, stroke_fill=DARK + (int(255 * ba),))
            if t >= 3.2:
                e = back((t - 3.2) / 0.35); sc = max(0.05, e); X0, Y0 = cx0 + 105 + shake, cy0 - 30
                w_, h_ = 190 * sc, 130 * sc
                d.rounded_rectangle(((X0) * k, (Y0 - h_ / 2) * k, (X0 + w_) * k, (Y0 + h_ / 2) * k), 12 * k, fill=(246, 243, 236, int(255 * ba)), outline=DARK + (int(255 * ba),), width=5 * k)
                for (xa, ya, xb, yb) in ((.08, .12, .92, .12), (.92, .12, .92, .88), (.92, .88, .08, .88), (.08, .88, .08, .12), (.45, .12, .45, .6), (.08, .6, .7, .6), (.7, .6, .7, .88)):
                    d.line(((X0 + xa * w_) * k, (Y0 - h_ / 2 + ya * h_) * k, (X0 + xb * w_) * k, (Y0 - h_ / 2 + yb * h_) * k), fill=DARK + (int(255 * ba),), width=int(4 * k))
            # X vermelho em cima do balão (quando fala "planta")
            for (p0, p1, t0_) in (((-300, -150), (300, 160), 3.62), ((300, -150), (-300, 160), 3.74)):
                pg = ease((t - t0_) / 0.15)
                if pg > 0: d.line(((cx0 + p0[0]) * k, (cy0 + p0[1]) * k, (cx0 + p0[0] + (p1[0] - p0[0]) * pg) * k, (cy0 + p0[1] + (p1[1] - p0[1]) * pg) * k), fill=RED + (int(255 * ba),), width=30 * k)
    if burst >= 0 and burst < 1:     # estouro do balão
        e = ease(burst)
        for i in range(18):
            ang = i / 18 * 6.2832 + 0.3; r = 60 + 320 * e; rr = max(2, 26 * (1 - e)); col = (255, 255, 255, 255) if i % 3 else YEL + (255,)
            X, Y = (cx0 + math.cos(ang) * r) * k, (cy0 + math.sin(ang) * r * 0.7) * k
            d.ellipse((X - rr * k, Y - rr * k, X + rr * k, Y + rr * k), fill=col)
    # pessoas (muita gente)
    ca = 1.0 if t < 4.0 else max(0.0, 1 - (t - 4.0) / 0.25)
    cols = (CYAN, WHITE, YEL, CYAN, WHITE); xs = (250, 375, 500, 625, 750)
    for i, (x, col) in enumerate(zip(xs, cols)):
        p = back((t - (2.3 + 0.07 * i)) / 0.3)
        if p <= 0: continue
        sc = max(0.05, p); pi = PEOPLE[col]; w_, h_ = int(pi.shape[1] * sc * 0.9), int(pi.shape[0] * sc * 0.9)
        bob = 7 * math.sin(t * 5 + i) if p >= 1 else 0
        pim = Image.fromarray(cv2.resize(pi, (w_, h_)))
        a_ = np.array(pim); a_[..., 3] = (a_[..., 3] * ca).astype(np.uint8)
        im.alpha_composite(Image.fromarray(a_).resize((int(w_ * k), int(h_ * k))), (int((x - w_ / 2) * k), int((455 + bob - h_) * k)))
    return np.array(im.resize((Wr, Hr), Image.LANCZOS))
def opening_motion(rgb, t):
    if t < 2.3 or t >= 4.35: return
    fr = bubble_frame(t); fa = 1.0 if t < 4.1 else max(0.0, 1 - (t - 4.1) / 0.25)
    blend(rgb, fr, 40, 240, fa)
def hook_overlay(out, t):
    if t < 2.3 or t >= 4.5: return
    exit_p = ease((t - 4.1) / 0.3) if t > 4.1 else 0.0; fa = 1 - exit_p
    def land(tt0, frm):
        p = (t - tt0) / 0.35
        if p < 0: return None
        e = back(p); dx = int(frm * (1 - min(1.0, e))) if p < 1.3 else 0
        if 0.35 <= (t - tt0) < 0.5: dx += random.Random(int(t * 100)).choice([-7, 7])
        return dx
    b1 = land(2.4, -W); b2 = land(2.57, W)
    if b1 is not None:
        im = hook_bar("NÃO É SÓ UMA PLANTA", WHITE, DARK, strike=(t - 3.62) / 0.35 if t > 3.62 else 0.0, rot=2.0)
        blend(out, im, (W - im.shape[1]) // 2 + b1, 738 - int(exit_p * 60), fa)
    if b2 is not None:
        im = hook_bar("É EXPERIÊNCIA VISUAL", CYAN, DARK, rot=-2.0)
        blend(out, im, (W - im.shape[1]) // 2 + b2, 836 - int(exit_p * 60), fa)

# ================= composição de cada quadro =================
def compose(t, base, kind):
    fr = base
    rgbs = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
    if t < T_SHRINK + 0.5:      # tela cheia -> encolhe
        e = easeio((t - T_SHRINK) / 0.5) if t >= T_SHRINK else 0.0
        if e <= 0:
            return opening_frame(rgbs, t)
        out = stage_bg(t); s = lerp(1.0, SC, e)
        off = (lerp(0, 230, e), lerp(0, 702, e)); win = (lerp(0, CARD[0], e), lerp(0, CARD[1], e), lerp(1080, CARD[2], e), lerp(1920, CARD[3], e))
        put_scaled(out, rgbs, s, off, win, lerp(0, 36, e), border=int(6 * e))
        draw_caption(out, t, int(lerp(1100, 1395, e))); return out
    if t < 10.74:                           # palco: você / imagens + ilustração
        out = stage_bg(t)
        if t < T_FLIP:
            put_scaled(out, rgbs, SC, (230, 702), CARD, 36, border=6)
        else:
            f = (t - T_FLIP) / 0.4
            if f < 0.5: put_scaled(out, prev_speaker[0], SC, (230, 702), CARD, 36, border=6, fx=max(0.03, 1 - easeio(f * 2)))
            else: put_scaled(out, rgbs, SC, (230, 634), CARD, 36, border=6, fx=max(0.03, easeio((f - 0.5) * 2)))
        scene_stage_extras(out, t); draw_caption(out, t, 1395); return out
    if t < 15.04:                           # palco: palavras + escada
        out = stage_bg(t); put_scaled(out, rgbs, SC, (230, 634), CARD, 36, border=6)
        scene_s3_motion(out, t); draw_caption(out, t, 1395); return out
    if t < 19.34:                           # palco: carimbo + cartões
        out = stage_bg(t); put_scaled(out, rgbs, SC, (230, 634), CARD, 36, border=6)
        scene_s4_extras(out, t); draw_caption(out, t, 1395); return out
    if t < 24.08:
        out = stage_bg(t); motion_scene(out, t); draw_caption(out, t, 1395); return out
    out = stage_bg(t); put_scaled(out, rgbs, SC, (230, 634), CARD, 36, border=6)
    if t >= T_OUT:
        e = ease((t - T_OUT) / 0.35); bg2 = stage_bg(t)
        out[880:1580] = (out[880:1580] * (1 - e) + bg2[880:1580] * e).astype(np.uint8)
    scene_s6_extras(out, t); outro(out, t); draw_caption(out, t, 1395); return out
prev_speaker = [None]

# ================= transições =================
def hsh(i, salt=0): return ((i * 2654435761 + salt * 97531) % 1000) / 1000.0
def _bar_tex(colw=78):
    tex = np.zeros((H, colw, 3), np.uint8)
    for c, (u, v_) in enumerate(zip((16, 34, 80), (6, 14, 36))): tex[..., c] = np.linspace(u, v_, H)[:, None]
    rng = random.Random(3)
    for y in range(40, H - 20, 36):
        for x in range(10, colw - 14, 22):
            col = YEL if rng.random() < 0.42 else (30, 70, 120)
            cv2.rectangle(tex, (x, y), (x + 12, y + 20), col, -1)
    cv2.rectangle(tex, (0, 0), (colw - 1, 8), CYAN, -1); cv2.rectangle(tex, (colw - 3, 0), (colw - 1, H), CYAN, -1)
    return tex
BAR = _bar_tex()
def tr_skyline(prev, cur, p):
    base = (prev if p < 0.5 else cur).copy(); cols = 14; cw = 78
    for i in range(cols):
        x0 = i * cw; x1 = min(W, x0 + cw)
        if p < 0.5:
            q = p * 2; c = easeio((q - 0.35 * hsh(i)) / 0.65); top = int(H * (1 - c))
            if top < H: base[top:, x0:x1] = BAR[top:, :x1 - x0]; cv2.rectangle(base, (x0, top), (x1 - 1, top + 5), WHITE, -1) if 0 < top < H - 6 else None
        else:
            u = (p - 0.5) * 2; r = easeio((u - 0.35 * hsh(i, 5)) / 0.65); bot = int(H * (1 - r))
            if bot > 0: base[:bot, x0:x1] = BAR[:bot, :x1 - x0]
    return base
BRW, BRH = 135, 54
def tr_bricks(prev, cur, p):
    base = (prev if p < 0.5 else cur).copy(); rows = H // BRH + 1; cols = W // BRW + 2
    for j in range(rows):
        off = -BRW // 2 if j % 2 else 0
        for i in range(cols):
            x = i * BRW + off; y = H - (j + 1) * BRH
            if p < 0.5: f = easeio(((p * 2) - (j / rows) * 0.62 - hsh(i * 91 + j) * 0.12) / 0.26)
            else: f = 1 - easeio((((p - 0.5) * 2) - ((rows - 1 - j) / rows) * 0.62 - hsh(i * 91 + j, 3) * 0.12) / 0.26)
            if f <= 0.01: continue
            cx, cy = x + BRW // 2, y + BRH // 2; w_, h_ = int(BRW * f), int(BRH * f)
            cv2.rectangle(base, (cx - w_ // 2, cy - h_ // 2), (cx + w_ // 2, cy + h_ // 2), (205, 198, 186), -1)
            sh = hsh(i * 7 + j, 9); col = (int(170 + 24 * sh), int(86 + 18 * sh), int(58 + 14 * sh))
            iw, ih = max(1, w_ - 8), max(1, h_ - 8)
            cv2.rectangle(base, (cx - iw // 2, cy - ih // 2), (cx + iw // 2, cy + ih // 2), col, -1)
            if f > 0.95: cv2.line(base, (cx - iw // 2, cy - ih // 2 + 5), (cx + iw // 2, cy - ih // 2 + 5), (210, 120, 86), 2)
    return base
_chipA = None
def tr_section(prev, cur, p):
    e = easeio(p); x = int(-140 + e * (W + 280)); out = prev.copy()
    if x > 0: out[:, :min(W, x)] = cur[:, :min(W, x)]
    # faixa de projeto
    x0, x1 = max(0, x - 120), min(W, x + 120)
    if x1 > x0:
        band = out[:, x0:x1].astype(np.float32); navy = np.array((9, 22, 52), np.float32)
        out[:, x0:x1] = (band * 0.42 + navy * 0.58).astype(np.uint8)
        for gy in range(0, H, 60): cv2.line(out, (x0, gy), (x1, gy), CYAN, 1)
        for gx in range(x0 - x0 % 40 + 40, x1, 40): cv2.line(out, (gx, 0), (gx, H), (0, 120, 140), 1)
    # régua com marcas
    for gy in range(0, H, 30): cv2.line(out, (x - 10 if gy % 120 else x - 24, gy), (x + 10 if gy % 120 else x + 24, gy), WHITE, 2)
    cv2.line(out, (x, 0), (x, H), CYAN, 6); cv2.line(out, (x - 120, 0), (x - 120, H), CYAN, 2); cv2.line(out, (x + 120, 0), (x + 120, H), CYAN, 2)
    for yy, sgn in ((330, 1), (1580, -1)):   # marcadores de corte
        cv2.circle(out, (x, yy), 46, WHITE, -1); cv2.circle(out, (x, yy), 46, CYAN, 6)
        cv2.putText(out, "A", (x - 17, yy + 17), cv2.FONT_HERSHEY_DUPLEX, 1.6, (20, 20, 24), 3, cv2.LINE_AA)
        cv2.fillConvexPoly(out, np.array([[x + 90, yy], [x + 52, yy - 24 * sgn * 0 - 22], [x + 52, yy + 22]], np.int32), CYAN)
    return out
def tr_tiles(prev, cur, p):
    cols, rows = 6, 10; tw_, th_ = W // cols, H // rows; out = prev.copy()
    for j in range(rows):
        for i in range(cols):
            dl = (i + (rows - 1 - j)) / (cols + rows - 2) * 0.45; f = min(1, max(0, (p - dl) / 0.5))
            x0, y0 = i * tw_, j * th_
            if f <= 0: continue
            if f >= 1: out[y0:y0 + th_, x0:x0 + tw_] = cur[y0:y0 + th_, x0:x0 + tw_]; continue
            out[y0:y0 + th_, x0:x0 + tw_] = (9, 22, 52)
            src = prev if f < 0.5 else cur; sc = abs(1 - 2 * f if f < 0.5 else 2 * f - 1)
            ws = max(3, int(tw_ * sc)); tile = cv2.resize(src[y0:y0 + th_, x0:x0 + tw_], (ws, th_), interpolation=cv2.INTER_AREA)
            xs = x0 + (tw_ - ws) // 2; out[y0:y0 + th_, xs:xs + ws] = tile
            cv2.rectangle(out, (xs, y0), (xs + ws - 1, y0 + th_ - 1), CYAN, 3)
    return out
def tr_lens(prev, cur, p):
    e = easeio(p); cx, cy = W // 2, H // 2
    def zm(img, z):
        M = np.float32([[z, 0, cx - z * cx], [0, z, cy - z * cy]]); return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    out = (zm(prev, 1 + 0.10 * e).astype(np.float32) * (1 - 0.45 * e)).astype(np.uint8)
    r = int(12 + e * 1300); inner = zm(cur, 1.12 - 0.12 * e)
    mk = np.zeros((H, W), np.uint8); cv2.circle(mk, (cx, cy), r, 255, -1); out[mk > 0] = inner[mk > 0]
    if r < 1250:
        cv2.circle(out, (cx, cy), r, (0, 0, 0), 22, cv2.LINE_AA); cv2.circle(out, (cx, cy), r, CYAN, 12, cv2.LINE_AA)
        cv2.circle(out, (cx, cy), max(2, r - 20), WHITE, 3, cv2.LINE_AA)
        rot = e * 120
        for a_ in range(0, 360, 6):
            ang = math.radians(a_ + rot); ln = 36 if a_ % 30 == 0 else 18
            p0 = (int(cx + math.cos(ang) * (r - 30)), int(cy + math.sin(ang) * (r - 30))); p1 = (int(cx + math.cos(ang) * (r - 30 - ln)), int(cy + math.sin(ang) * (r - 30 - ln)))
            cv2.line(out, p0, p1, WHITE, 3 if a_ % 30 == 0 else 2, cv2.LINE_AA)
        for a_ in (0, 90, 180, 270):    # linhas de mira
            ang = math.radians(a_ + rot * 0.3); p0 = (int(cx + math.cos(ang) * (r + 18)), int(cy + math.sin(ang) * (r + 18))); p1 = (int(cx + math.cos(ang) * (r + 90)), int(cy + math.sin(ang) * (r + 90)))
            cv2.line(out, p0, p1, CYAN, 6, cv2.LINE_AA)
        cv2.line(out, (cx - 26, cy), (cx + 26, cy), WHITE, 3); cv2.line(out, (cx, cy - 26), (cx, cy + 26), WHITE, 3)
    return out
def transition(kind, prev, cur, p):
    p = min(1.0, max(0.0, p))
    return {"lens": tr_lens, "skyline": tr_skyline, "bricks": tr_bricks, "section": tr_section, "tiles": tr_tiles}[kind](prev, cur, p)

def vf_for(src, kind):
    if kind == "fala": return f"crop=1022:1816:1080:785,scale={W}:{H}:flags=lanczos,fps={FPS},{HDRC}"
    if src in (F2303, F2304): return f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},fps={FPS},{HDRC}"
    return f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}"
# ================= loop principal =================
wr = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                       "-i", "-", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", V + "v21_semaudio.mp4"], stdin=subprocess.PIPE)
fsz = W * H * 3; n_out = 0; last_frame = None
# quadro congelado do palestrante para a virada do cartão
sp = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", "9.79", "-i", RAW, "-frames:v", "1", "-vf", vf_for(RAW, "fala"), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True).stdout
prev_speaker[0] = cv2.cvtColor(np.frombuffer(sp, np.uint8).reshape(H, W, 3).copy(), cv2.COLOR_BGR2RGB)
hold = None
for (t0, t1, src, ss_, kind) in SHOTS:
    nfr = int(round((t1 - t0) * FPS))
    rd = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-ss", str(ss_), "-t", str(t1 - t0 + 0.2), "-i", src,
                           "-vf", vf_for(src, kind), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    last = None
    for k in range(nfr):
        buf = rd.stdout.read(fsz)
        if len(buf) == fsz: last = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        t = n_out / FPS
        rgb = compose(t, last.copy(), kind)
        tr = TRANS.get(round(t0, 2))
        if tr and hold is not None and t - t0 < tr[1]:
            rgb = transition(tr[0], hold, rgb, (t - t0) / tr[1])
        wr.stdin.write(rgb.tobytes()); n_out += 1; cur_last = rgb
        if k == nfr - 1: hold = compose(t1 - 1 / FPS, last.copy(), kind) if t1 - 1 / FPS >= 0 else rgb
    rd.stdout.close(); rd.wait()
wr.stdin.close(); wr.wait()
print("quadros", n_out, n_out / FPS)
json.dump({"T_SHRINK": T_SHRINK, "T_FLIP": T_FLIP, "T_HOUSE": T_HOUSE_S, "T_VISUAL": T_VISUAL, "T_STAMP": T_STAMP, "T_HELM": T_HELM, "T_PERS": T_PERS,
           "T_SHIELD": T_SHIELD, "T_BARS": T_BARS, "T_CMT": T_CMT, "T_TAG": T_TAG, "TRANS": list(TRANS)}, open(V + "tempos_v21.json", "w"))
