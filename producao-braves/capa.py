import importlib.util, math, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

BASE = "/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"
_sp = importlib.util.spec_from_file_location("casa", BASE + "casa.py"); casa = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(casa)
W, H = 1080, 1920
YEL, WHITE, CYAN, RED, DARK = (255, 196, 0), (255, 255, 255), (0, 229, 255), (225, 6, 0), (20, 20, 24)
def F(s): return ImageFont.truetype(BASE + "fontes/Anton-Regular.ttf", s)
def canvas(w, h): return Image.new("RGBA", (w, h), (0, 0, 0, 0))
def tw(d, t, f, sw=0):
    b = d.textbbox((0, 0), t, font=f, stroke_width=sw); return b[2] - b[0], b[3] - b[1]

# ---------- fundo azul de projeto ----------
bg = np.zeros((H, W, 3), np.float32)
for c, (a, b) in enumerate(zip((16, 40, 92), (5, 12, 34))): bg[..., c] = np.linspace(a, b, H)[:, None]
yy, xx = np.mgrid[0:H, 0:W]
glow = np.exp(-(((xx - 540) / 620.0) ** 2 + ((yy - 1250) / 520.0) ** 2)); bg += glow[..., None] * np.array((0, 40, 70))
for i in range(0, W, 60): bg[:, i] = bg[:, i] * 0.88 + np.array(CYAN) * 0.12
for j in range(0, H, 60): bg[j, :] = bg[j, :] * 0.88 + np.array(CYAN) * 0.12
for i in range(0, W, 240): bg[:, i] = bg[:, i] * 0.78 + np.array(CYAN) * 0.22
for j in range(0, H, 240): bg[j, :] = bg[j, :] * 0.78 + np.array(CYAN) * 0.22
vig = 1 - 0.45 * (((xx - 540) / 700.0) ** 2 + ((yy - 960) / 1100.0) ** 2); bg *= np.clip(vig, 0.4, 1)[..., None]
img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).convert("RGBA")
rng = random.Random(11); d = ImageDraw.Draw(img, "RGBA")
for _ in range(34):
    x, y = rng.randint(40, 1040), rng.randint(60, 1860); a = rng.randint(70, 150)
    d.line((x - 9, y, x + 9, y), fill=CYAN + (a,), width=3); d.line((x, y - 9, x, y + 9), fill=CYAN + (a,), width=3)

def paste(im_np, x, y, a=1.0):
    t = Image.fromarray(im_np)
    if a < 1: arr = np.array(t); arr[..., 3] = (arr[..., 3] * a).astype(np.uint8); t = Image.fromarray(arr)
    img.alpha_composite(t, (int(x), int(y)))
def shadow(w, h, r, blur=22, alpha=170, off=18):
    s = Image.new("RGBA", (w + 160, h + 160), (0, 0, 0, 0)); ImageDraw.Draw(s).rounded_rectangle((80, 80 + off, 80 + w, 80 + h + off), r, fill=(0, 0, 0, alpha))
    return s.filter(ImageFilter.GaussianBlur(blur))
from PIL import ImageFilter

# ---------- logo ----------
logo = Image.open(BASE + "logos/word_white.png").convert("RGBA"); lw = 700; lh = int(logo.height * lw / logo.width); logo = logo.resize((lw, lh), Image.LANCZOS)
glowl = logo.copy(); arr = np.array(glowl); arr[..., 0], arr[..., 1], arr[..., 2] = CYAN; glowl = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(14))
lx, ly = (W - lw) // 2, 250
img.alpha_composite(glowl, (lx, ly)); img.alpha_composite(logo, (lx, ly))

# ---------- título ----------
d = ImageDraw.Draw(img, "RGBA")
def center_text(t, y, size, col, sw=7, sc=(0, 0, 0)):
    f = F(size); w_, h_ = tw(d, t, f, sw); d.text(((W - w_) // 2 + 6, y + 8), t, font=f, fill=(0, 0, 0, 200), stroke_width=sw, stroke_fill=(0, 0, 0, 200))
    d.text(((W - w_) // 2, y), t, font=f, fill=col + (255,), stroke_width=sw, stroke_fill=sc + (255,))
center_text("PROJETOS DA BRAVES", 566, 98, WHITE)
center_text("NÃO SÃO SOMENTE", 676, 76, CYAN)

# ---------- dois "não": planta 2D e papel ----------
def paper_card(kind):
    w, h = 400, 290; c = canvas(w + 40, h + 40); cd = ImageDraw.Draw(c, "RGBA")
    cd.rounded_rectangle((20, 20, 20 + w, 20 + h), 18, fill=(247, 244, 237, 255), outline=(255, 255, 255, 255), width=3)
    ink = (38, 42, 56, 255)
    if kind == "plan":
        sx, sy, x0, y0 = 34.0, 34.0, 60, 52   # planta simples em tinta
        def P(x, y): return (x0 + x * 31.5, y0 + y * 31.0)
        def L(a, b, wd=5): cd.line([P(*a), P(*b)], fill=ink, width=wd)
        for a, b in (((0, 0), (10, 0)), ((10, 0), (10, 7)), ((10, 7), (0, 7)), ((0, 7), (0, 0))): L(a, b, 7)
        for a, b in (((5, 0), (5, 4)), ((0, 4), (10, 4)), ((7.5, 4), (7.5, 7))): L(a, b, 5)
        for (x, y) in ((2.2, 1.2), (7.2, 1.2)): cd.rectangle((P(x, y)[0], P(x, y)[1], P(x + 1.8, y + 2)[0], P(x + 1.8, y + 2)[1]), outline=ink, width=3)
        cd.rectangle((P(0.7, 5.2)[0], P(0.7, 5.2)[1], P(3.2, 6.6)[0], P(3.2, 6.6)[1]), outline=ink, width=3)
    else:   # folha de papel dobrada com linhas
        for i in range(7): cd.line((60, 70 + i * 32, 60 + 280 - (i % 3) * 40, 70 + i * 32), fill=(150, 150, 160, 255), width=4)
        cd.polygon([(20 + w, 20 + h), (20 + w - 80, 20 + h), (20 + w, 20 + h - 80)], fill=(222, 218, 208, 255))
        cd.polygon([(20 + w - 80, 20 + h), (20 + w, 20 + h - 80), (20 + w - 80, 20 + h - 80)], fill=(205, 200, 190, 255))
    # X vermelho
    cd.line((60, 60, 20 + w - 40, 20 + h - 40), fill=RED + (255,), width=34); cd.line((20 + w - 40, 60, 60, 20 + h - 40), fill=RED + (255,), width=34)
    return c
def chip(text, bg_, fg):
    f = F(54); w_ = tw(d, text, f)[0] + 70; c = canvas(w_, 84); cd = ImageDraw.Draw(c); cd.rounded_rectangle((0, 0, w_ - 1, 83), 22, fill=bg_ + (255,)); cd.text((35, 10), text, font=f, fill=fg + (255,)); return c
for kind, x, y, rot, lab in (("plan", 96, 778, 4, "PLANTAS 2D"), ("paper", 600, 784, -4, "SÓ PAPEL")):
    c = paper_card(kind); c = c.resize((int(c.width * 0.85), int(c.height * 0.85)), Image.LANCZOS); sh = shadow(c.width - 34, c.height - 34, 18); sh = sh.rotate(rot, expand=True, resample=Image.BICUBIC)
    cr = c.rotate(rot, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(sh, (x - 80 - (sh.width - c.width) // 2 + 40, y - 80 - (sh.height - c.height) // 2 + 40)); img.alpha_composite(cr, (x - (cr.width - c.width) // 2, y - (cr.height - c.height) // 2))
    ch = chip(lab, WHITE, RED); img.alpha_composite(ch, (x + (c.width - ch.width) // 2, y + c.height - 52))

# ---------- cenário de experiência visual ----------
HW_, HH_ = 920, 380
def make_sky(w, h):
    t = np.linspace(0, 1, h)
    cols = [np.interp(t, [0, 0.55, 0.85, 1], c) for c in ([24, 92, 250, 255], [62, 150, 176, 196], [132, 224, 118, 120])]
    im = np.stack([np.repeat(c[:, None], w, axis=1) for c in cols], axis=2).astype(np.float32)
    y_, x_ = np.mgrid[0:h, 0:w]; dist = np.sqrt((x_ - 0.74 * w) ** 2 + (y_ - 0.48 * h) ** 2)
    im += np.exp(-(dist / (0.15 * w)) ** 2)[..., None] * np.array((255, 215, 140)) * 0.9
    cl = np.zeros((h, w), np.float32)
    for (cx, cy, rx, ry) in ((150, 80, 100, 22), (230, 100, 74, 16), (560, 62, 110, 20), (480, 118, 66, 14), (780, 150, 76, 15)): cv2.ellipse(cl, (cx, cy), (rx, ry), 0, 0, 360, 1.0, -1)
    cl = cv2.GaussianBlur(cl, (0, 0), 9); im = im * (1 - cl[..., None] * 0.55) + 255 * cl[..., None] * 0.55
    return np.clip(im, 0, 255).astype(np.uint8)
sky = make_sky(HW_, HH_)
r3, _ = casa.render3d(10.45)
tile = cv2.resize(r3[40:610, 100:900], (500, 356), interpolation=cv2.INTER_AREA)
reg = np.zeros((HH_, HW_, 4), np.uint8); oy, ox = HH_ - 356 - 6, (HW_ - 500) // 2; reg[oy:oy + 356, ox:ox + 500] = tile
hsv = cv2.cvtColor(reg[..., :3], cv2.COLOR_RGB2HSV).astype(np.float32); hsv[..., 1] = np.clip(hsv[..., 1] * 1.35, 0, 255); hsv[..., 2] = np.clip(hsv[..., 2] * 1.06, 0, 255)
col = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32); col[..., 0] *= 1.07; col[..., 2] *= 0.94; reg[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
al = reg[..., 3:4].astype(np.float32) / 255; scene = (sky * (1 - al) + reg[..., :3] * al).astype(np.uint8)
for (x, y, r, a) in ((700, 90, 30, .9), (160, 120, 20, .8), (820, 300, 22, .7), (90, 330, 16, .7), (440, 50, 18, .8)):
    pts = np.array([[x, y - r], [x + r * .22, y - r * .22], [x + r, y], [x + r * .22, y + r * .22], [x, y + r], [x - r * .22, y + r * .22], [x - r, y], [x - r * .22, y - r * .22]], np.int32)
    ov = scene.copy(); cv2.fillPoly(ov, [pts], (255, 255, 255)); cv2.addWeighted(ov, a, scene, 1 - a, 0, scene)
mk = Image.new("L", (HW_, HH_), 0); ImageDraw.Draw(mk).rounded_rectangle((0, 0, HW_ - 1, HH_ - 1), 46, fill=255)
card = Image.fromarray(scene).convert("RGBA"); card.putalpha(mk)
ring = Image.new("RGBA", (HW_, HH_), (0, 0, 0, 0)); ImageDraw.Draw(ring).rounded_rectangle((0, 0, HW_ - 1, HH_ - 1), 46, outline=CYAN + (255,), width=8)
cx, cy = 80, 1100
img.alpha_composite(shadow(HW_, HH_, 46, 28, 190, 22), (cx - 80, cy - 80)); img.alpha_composite(card, (cx, cy)); img.alpha_composite(ring, (cx, cy))
# olho
ey = casa.Image if False else None
d = ImageDraw.Draw(img, "RGBA")
ex, ey_ = cx + HW_ - 140, cy + 62
d.ellipse((ex - 62, ey_ - 38, ex + 62, ey_ + 38), fill=WHITE + (255,), outline=DARK + (255,), width=6)
d.ellipse((ex - 25, ey_ - 25, ex + 25, ey_ + 25), fill=CYAN + (255,)); d.ellipse((ex - 11, ey_ - 11, ex + 11, ey_ + 11), fill=DARK + (255,)); d.ellipse((ex + 4, ey_ - 15, ex + 14, ey_ - 5), fill=WHITE + (255,))

# ---------- faixa final ----------
def bar(text, bgc, fg, w, rot, size=66):
    f = F(size); w_, h_ = tw(d, text, f); bw = w_ + 90; c = canvas(bw, 112); cd = ImageDraw.Draw(c); cd.rounded_rectangle((0, 0, bw - 1, 111), 16, fill=bgc + (255,)); cd.text((45, 12), text, font=f, fill=fg + (255,))
    return c.rotate(rot, expand=True, resample=Image.BICUBIC)
b1 = bar("A MELHOR EXPERIÊNCIA VISUAL", CYAN, DARK, 0, 1.6); b2 = bar("EM PROJETOS", YEL, DARK, 0, -1.6)
sh1 = shadow(b1.width - 20, b1.height - 20, 16, 14, 160, 10); img.alpha_composite(sh1, ((W - b1.width) // 2 - 70, 1425 - 70)); img.alpha_composite(b1, ((W - b1.width) // 2, 1425))
sh2 = shadow(b2.width - 20, b2.height - 20, 16, 14, 160, 10); img.alpha_composite(sh2, ((W - b2.width) // 2 - 70, 1520 - 70)); img.alpha_composite(b2, ((W - b2.width) // 2, 1520))

out = img.convert("RGB"); out.save(BASE + "video1/capa_braves.png")
# versão 4:5 (grade do Instagram): recorte central
out.crop((0, 285, 1080, 1635)).save(BASE + "video1/capa_braves_grade_4x5.png")
print("ok")
