"""Planta baixa CAD + modelo 3D montado por etapas (mesma geometria nas duas)."""
import math, random
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

BASE = "/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"
ANTON = BASE + "fontes/Anton-Regular.ttf"
RW, RH = 1000, 705
CYAN, YEL, WHITE, DARK = (0, 229, 255), (255, 196, 0), (255, 255, 255), (20, 20, 24)
def F(s): return ImageFont.truetype(ANTON, s)
def ease(p): p = min(max(p, 0.0), 1.0); return 1 - (1 - p) ** 3
def easeio(p): p = min(max(p, 0.0), 1.0); return 3 * p * p - 2 * p ** 3
def back(p):
    p = min(max(p, 0.0), 1.0); c = 1.70158; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2
def lerp(a, b, e): return a + (b - a) * e
def mix(c1, c2, e): return tuple(int(lerp(a, b, e)) for a, b in zip(c1, c2))

# ---------------------------------------------------------------- geometria (metros)
HW = 2.8   # altura das paredes
EXT, INT = 0.22, 0.14
# (eixo, posição, a0, a1, espessura, aberturas[(o0,o1,peitoril,verga)])
WALLS = [
    ("x", 0.0, 0.0, 10.0, EXT, [(1.4, 3.6, 0.9, 2.1), (6.4, 8.6, 0.9, 2.1)]),
    ("x", 7.0, 0.0, 10.0, EXT, [(3.0, 4.2, 0.0, 2.2), (5.2, 7.0, 0.9, 2.1), (8.3, 9.3, 1.5, 2.1)]),
    ("y", 0.0, 0.0, 7.0, EXT, [(1.2, 2.6, 0.9, 2.1), (5.0, 6.5, 0.9, 2.1)]),
    ("y", 10.0, 0.0, 7.0, EXT, [(1.2, 2.6, 0.9, 2.1)]),
    ("x", 4.0, 0.0, 10.0, INT, [(1.0, 1.9, 0.0, 2.1), (6.0, 6.9, 0.0, 2.1)]),
    ("y", 5.0, 0.0, 4.0, INT, []),
    ("y", 7.5, 4.0, 7.0, INT, [(5.0, 5.9, 0.0, 2.1)]),
]
ROOMS = [("QUARTO 1", 2.5, 3.35), ("QUARTO 2", 7.5, 3.35), ("SALA", 2.0, 4.65), ("COZINHA", 6.0, 4.65), ("BANHO", 8.75, 4.7)]

def wall_boxes(w):
    ax, pos, a0, a1, th, ops = w; out = []   # (x0,y0,z0,x1,y1,z1, tipo)
    def mk(s0, s1, z0, z1, tipo="wall"):
        if s1 - s0 < 1e-3 or z1 - z0 < 1e-3: return
        if ax == "x": out.append((s0, pos - th / 2, z0, s1, pos + th / 2, z1, tipo))
        else: out.append((pos - th / 2, s0, z0, pos + th / 2, s1, z1, tipo))
    cur = a0
    for (o0, o1, sill, head) in sorted(ops):
        mk(cur, o0, 0, HW); mk(o0, o1, 0, sill); mk(o0, o1, head, HW); cur = o1
    mk(cur, a1, 0, HW)
    return out

def plan_segments():
    """segmentos de parede em planta (retângulos), na ordem de desenho"""
    segs = []
    for w in WALLS:
        for (x0, y0, z0, x1, y1, z1, tp) in wall_boxes(w):
            if z0 == 0 and z1 == HW: segs.append((x0, y0, x1, y1))
    return segs

# ---------------------------------------------------------------- PLANTA CAD
PS, PX0, PY0 = 80.0, 100.0, 72.0
def P(x, y): return (PX0 + x * PS, PY0 + y * PS)

FURN = [  # (tipo, x0,y0,x1,y1)
    ("bed", 1.6, 0.35, 3.6, 2.35), ("rob", 0.2, 2.9, 0.8, 3.85), ("night", 1.15, 0.35, 1.5, 0.7),
    ("bed", 6.6, 0.35, 8.6, 2.35), ("rob", 9.2, 2.6, 9.8, 3.85), ("night", 8.7, 0.35, 9.05, 0.7),
    ("sofa", 0.5, 5.9, 3.0, 6.8), ("table", 1.3, 4.95, 2.3, 5.55), ("dining", 4.3, 5.45, 6.1, 6.35),
    ("counter", 4.3, 4.15, 7.3, 4.8), ("wc", 9.15, 4.3, 9.65, 5.0), ("sink", 8.0, 6.35, 8.7, 6.85), ("shower", 8.85, 5.6, 9.85, 6.85),
]
def furn_draw(d, k, f, col, a):
    tp, x0, y0, x1, y1 = f; c = col + (a,)
    (X0, Y0), (X1, Y1) = P(x0, y0), P(x1, y1)
    def R(xa, ya, xb, yb, **kw): d.rectangle((xa * k, ya * k, xb * k, yb * k), **kw)
    if tp == "bed":
        R(X0, Y0, X1, Y1, outline=c, width=3 * k); R(X0 + 8, Y0 + 8, X0 + (X1 - X0) / 2 - 6, Y0 + 52, outline=c, width=2 * k)
        R(X0 + (X1 - X0) / 2 + 6, Y0 + 8, X1 - 8, Y0 + 52, outline=c, width=2 * k); d.line([(X0 * k, (Y0 + 80) * k), (X1 * k, (Y0 + 80) * k)], fill=c, width=2 * k)
    elif tp in ("rob", "counter"):
        R(X0, Y0, X1, Y1, outline=c, width=3 * k); d.line([(X0 * k, Y0 * k), (X1 * k, Y1 * k)], fill=c, width=1 * k)
        if tp == "counter":
            d.ellipse(((X0 + 36) * k, (Y0 + 14) * k, (X0 + 66) * k, (Y0 + 44) * k), outline=c, width=2 * k)
            for i in range(4): d.ellipse(((X0 + 150 + (i % 2) * 22) * k, (Y0 + 12 + (i // 2) * 22) * k, (X0 + 164 + (i % 2) * 22) * k, (Y0 + 26 + (i // 2) * 22) * k), outline=c, width=2 * k)
    elif tp == "night": R(X0, Y0, X1, Y1, outline=c, width=2 * k)
    elif tp == "sofa":
        R(X0, Y0, X1, Y1, outline=c, width=3 * k); R(X0, Y1 - 22, X1, Y1, outline=c, width=2 * k)
        d.line([((X0 + (X1 - X0) / 2) * k, Y0 * k), ((X0 + (X1 - X0) / 2) * k, (Y1 - 22) * k)], fill=c, width=2 * k)
    elif tp == "table": R(X0, Y0, X1, Y1, outline=c, width=3 * k)
    elif tp == "dining":
        d.rounded_rectangle((X0 * k, Y0 * k, X1 * k, Y1 * k), 14 * k, outline=c, width=3 * k)
        for i in range(2):
            for yy in (Y0 - 26, Y1 + 6): d.ellipse(((X0 + 22 + i * 90) * k, yy * k, (X0 + 52 + i * 90) * k, (yy + 22) * k), outline=c, width=2 * k)
    elif tp == "wc":
        d.rounded_rectangle((X0 * k, Y0 * k, X1 * k, (Y0 + 14) * k), 4 * k, outline=c, width=2 * k)
        d.ellipse((X0 * k + 2 * k, (Y0 + 12) * k, X1 * k - 2 * k, Y1 * k), outline=c, width=2 * k)
    elif tp == "sink": d.rounded_rectangle((X0 * k, Y0 * k, X1 * k, Y1 * k), 8 * k, outline=c, width=2 * k); d.ellipse(((X0 + 14) * k, (Y0 + 8) * k, (X1 - 14) * k, (Y1 - 8) * k), outline=c, width=2 * k)
    elif tp == "shower": R(X0, Y0, X1, Y1, outline=c, width=2 * k); d.line([(X0 * k, Y0 * k), (X1 * k, Y1 * k)], fill=c, width=1 * k); d.line([(X1 * k, Y0 * k), (X0 * k, Y1 * k)], fill=c, width=1 * k)

def plan_cad(t):
    """t = segundos desde o início do desenho; devolve RGBA RWxRH"""
    k = 2; im = Image.new("RGBA", (RW * k, RH * k), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
    segs = plan_segments(); lens = [max(x1 - x0, y1 - y0) for (x0, y0, x1, y1) in segs]; tot = sum(lens)
    WALL_T = 1.0; pw = min(1, t / WALL_T); budget = pw * tot; tip = None
    for (x0, y0, x1, y1), L in zip(segs, lens):
        if budget <= 0: break
        f = min(1, budget / L); budget -= L
        if x1 - x0 >= y1 - y0: xe, ye = x0 + (x1 - x0) * f, y1; tipw = (xe, (y0 + y1) / 2)
        else: xe, ye = x1, y0 + (y1 - y0) * f; tipw = ((x0 + x1) / 2, ye)
        A, B = P(x0, y0), P(xe, ye)
        d.rectangle((A[0] * k, A[1] * k, B[0] * k, B[1] * k), fill=(235, 245, 255, 255), outline=CYAN + (255,), width=2 * k)
        tip = tipw
    wall_done = pw >= 1
    # hachura dos tijolos (linhas finas nas paredes) após fechar
    # aberturas: portas e janelas
    to = t - WALL_T - 0.05
    if to > 0:
        i = 0
        for (ax, pos, a0, a1, th, ops) in WALLS:
            for (o0, o1, sill, head) in ops:
                p = ease((to - i * 0.03) / 0.22); i += 1
                if p <= 0: continue
                if sill == 0:   # porta: folha + arco
                    if ax == "x":
                        hx = o0; A = P(hx, pos); w_ = (o1 - o0) * PS; sgn = 1 if pos < 3.5 else -1
                        # folha perpendicular e arco
                        d.line([(A[0] * k, A[1] * k), (A[0] * k, (A[1] + sgn * w_ * p) * k)], fill=YEL + (255,), width=3 * k)
                        d.arc(((A[0] - w_) * k, (A[1] - w_) * k, (A[0] + w_) * k, (A[1] + w_) * k), 0 if sgn > 0 else 270, (90 * p) if sgn > 0 else 270 + 90 * p, fill=CYAN + (220,), width=2 * k) if False else None
                        for ang in np.linspace(0, math.pi / 2 * p, 14): pass
                        pts = [(A[0] + w_ * math.cos(a), A[1] + sgn * w_ * math.sin(a)) for a in np.linspace(0, math.pi / 2 * p, 16)]
                        d.line([(x * k, y * k) for x, y in pts], fill=CYAN + (230,), width=2 * k)
                    else:
                        A = P(pos, o0); w_ = (o1 - o0) * PS; sgn = 1 if pos < 5 else -1
                        d.line([(A[0] * k, A[1] * k), ((A[0] + sgn * w_ * p) * k, A[1] * k)], fill=YEL + (255,), width=3 * k)
                        pts = [(A[0] + sgn * w_ * math.sin(a), A[1] + w_ * math.cos(a)) for a in np.linspace(0, math.pi / 2 * p, 16)]
                        d.line([(x * k, y * k) for x, y in pts], fill=CYAN + (230,), width=2 * k)
                else:           # janela: três linhas
                    if ax == "x":
                        for dy in (-th / 2, 0, th / 2):
                            A, B = P(o0, pos + dy), P(o0 + (o1 - o0) * p, pos + dy)
                            d.line([(A[0] * k, A[1] * k), (B[0] * k, B[1] * k)], fill=YEL + (255,), width=2 * k)
                    else:
                        for dx in (-th / 2, 0, th / 2):
                            A, B = P(pos + dx, o0), P(pos + dx, o0 + (o1 - o0) * p)
                            d.line([(A[0] * k, A[1] * k), (B[0] * k, B[1] * k)], fill=YEL + (255,), width=2 * k)
    # cotas (sem números)
    tc = t - 1.1
    if tc > 0:
        p = ease(tc / 0.35)
        for (a, b, off, hor) in (((0, 7.0), (10, 7.0), 0.7, True), ((10, 0), (10, 7.0), 0.75, False)):
            (X0, Y0), (X1, Y1) = P(*a), P(*b)
            if hor:
                y = Y0 + off * PS; xe = X0 + (X1 - X0) * p
                d.line([(X0 * k, y * k), (xe * k, y * k)], fill=WHITE + (200,), width=2 * k)
                for xx in (X0, xe): d.line([((xx - 7) * k, (y + 7) * k), ((xx + 7) * k, (y - 7) * k)], fill=WHITE + (230,), width=3 * k)
                d.line([(X0 * k, (Y0 + 8) * k), (X0 * k, (y + 8) * k)], fill=WHITE + (120,), width=1 * k); d.line([(X1 * k, (Y0 + 8) * k), (X1 * k, (y + 8) * k)], fill=WHITE + (120,), width=1 * k)
            else:
                x = X0 + off * PS; ye = Y0 + (Y1 - Y0) * p
                d.line([(x * k, Y0 * k), (x * k, ye * k)], fill=WHITE + (200,), width=2 * k)
                for yy in (Y0, ye): d.line([((x - 7) * k, (yy + 7) * k), ((x + 7) * k, (yy - 7) * k)], fill=WHITE + (230,), width=3 * k)
    # móveis
    tf = t - 1.2
    for i, f in enumerate(FURN):
        p = ease((tf - i * 0.03) / 0.18)
        if p > 0: furn_draw(d, k, f, (170, 235, 255), int(220 * p))
    # nomes dos cômodos (digitando)
    tl = t - 1.35; f = F(24 * k)
    for i, (nm, x, y) in enumerate(ROOMS):
        n = int(max(0, tl - i * 0.08) / 0.03)
        if n > 0:
            tx = nm[:n]; X, Y = P(x, y); w_ = d.textlength(nm, font=f)
            d.text((X * k - w_ / 2, Y * k - 12 * k), tx, font=f, fill=WHITE + (235,))
    # norte
    if t > 1.3:
        p = ease((t - 1.3) / 0.3); cx, cy = 925, 95
        d.ellipse(((cx - 30) * k, (cy - 30) * k, (cx + 30) * k, (cy + 30) * k), outline=CYAN + (int(255 * p),), width=3 * k)
        d.polygon([(cx * k, (cy - 26) * k), ((cx - 9) * k, (cy + 8) * k), (cx * k, (cy + 1) * k), ((cx + 9) * k, (cy + 8) * k)], fill=CYAN + (int(255 * p),))
        d.text(((cx - 8) * k, (cy + 26) * k), "N", font=F(26 * k), fill=WHITE + (int(255 * p),))
    # cursor CAD
    if tip is not None and not wall_done:
        X, Y = P(*tip)
        d.line([((X - 55) * k, Y * k), ((X + 55) * k, Y * k)], fill=WHITE + (230,), width=1 * k); d.line([(X * k, (Y - 55) * k), (X * k, (Y + 55) * k)], fill=WHITE + (230,), width=1 * k)
        d.rectangle(((X - 7) * k, (Y - 7) * k, (X + 7) * k, (Y + 7) * k), outline=YEL + (255,), width=3 * k)
    return np.array(im.resize((RW, RH), Image.LANCZOS))

# ---------------------------------------------------------------- MODELO 3D
BRICK, PAINT, CONC = (178, 96, 66), (246, 244, 240), (176, 178, 184)
GLASS, FRAME, WOOD, GRAPH = (150, 205, 235), (44, 50, 60), (140, 92, 54), (62, 66, 76)
LIGHT = np.array([-0.55, 0.45, 0.70]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
T0 = 5.85   # começa a subir

def build_elements():
    els = []   # dict(box, kind, t0, dur, anim, col, col2)
    order = 0
    for w in WALLS:
        for b in wall_boxes(w):
            x0, y0, z0, x1, y1, z1, tp = b
            els.append(dict(box=(x0, y0, z0, x1, y1, z1), kind="wall", t0=T0 + 0.05 + 0.012 * order, dur=0.45, anim="grow", col=BRICK, col2=PAINT, sill=(z0 > 0 or z1 < HW), interior=(w[4] == INT)))
            order += 1
    # laje e platibanda
    els.append(dict(box=(-0.3, -0.3, 2.8, 10.3, 7.3, 3.05), kind="slab", t0=6.9, dur=0.45, anim="drop", col=CONC, col2=(232, 232, 236)))
    for ix in range(6):
        for iy in range(4):
            x0_, x1_ = -0.3 + ix * 10.6 / 6, -0.3 + (ix + 1) * 10.6 / 6; y0_, y1_ = -0.3 + iy * 7.6 / 4, -0.3 + (iy + 1) * 7.6 / 4
            els.append(dict(box=(x0_, y0_, 2.8, x1_, y1_, 3.05), kind="tile", t0=6.9, dur=0.45, anim="drop", col=CONC, col2=(232, 232, 236)))
    els.append(dict(box=(6.1, 1.0, 3.05, 9.4, 2.7, 3.2), kind="solar", t0=8.55, dur=0.35, anim="drop", col=(28, 48, 98), col2=(28, 48, 98)))
    els.append(dict(box=(0.8, 5.0, 3.05, 1.9, 6.1, 4.2), kind="tank", t0=8.7, dur=0.3, anim="grow", col=(210, 224, 235), col2=(210, 224, 235)))
    th = 0.16
    for bx in ((-0.3, -0.3, 3.05, 10.3, -0.3 + th, 3.55), (-0.3, 7.3 - th, 3.05, 10.3, 7.3, 3.55), (-0.3, -0.3, 3.05, -0.3 + th, 7.3, 3.55), (10.3 - th, -0.3, 3.05, 10.3, 7.3, 3.55)):
        els.append(dict(box=bx, kind="wall", t0=7.3, dur=0.3, anim="grow", col=CONC, col2=PAINT, sill=False))
    # fachada: painel grafite e ripado de madeira
    els.append(dict(box=(4.35, 7.11, 0.0, 7.2, 7.17, 2.8), kind="accent", t0=7.6, dur=0.4, anim="grow", col=GRAPH, col2=GRAPH))
    for i in range(7):
        x = 0.35 + i * 0.36
        els.append(dict(box=(x, 7.11, 0.0, x + 0.17, 7.2, 2.8), kind="accent", t0=7.65 + i * 0.03, dur=0.3, anim="grow", col=WOOD, col2=WOOD))
    # marquise da entrada
    els.append(dict(box=(2.7, 7.1, 2.4, 4.5, 8.5, 2.55), kind="accent", t0=8.3, dur=0.3, anim="drop", col=GRAPH, col2=GRAPH))
    for (x, y) in ((2.8, 8.38), (4.4, 8.38)):
        els.append(dict(box=(x, y, 0.0, x + 0.1, y + 0.1, 2.4), kind="accent", t0=8.4, dur=0.25, anim="grow", col=GRAPH, col2=GRAPH))
    # esquadrias
    n = 0
    for (ax, pos, a0, a1, th_, ops) in WALLS:
        if th_ != EXT: continue
        for (o0, o1, sill, head) in ops:
            tt = 8.0 + 0.07 * n; n += 1
            if sill == 0:
                if ax == "x": db = (o0, pos - 0.09, sill, o1, pos + 0.09, head)
                else: db = (pos - 0.09, o0, sill, pos + 0.09, o1, head)
                els.append(dict(box=db, kind="door", t0=tt, dur=0.35, anim="fade", col=WOOD, col2=WOOD))
            else:
                bw = 0.07; bars = []
                if ax == "x":
                    y0_, y1_ = pos - 0.09, pos + 0.09
                    bars = [(o0, y0_, sill, o0 + bw, y1_, head), (o1 - bw, y0_, sill, o1, y1_, head), (o0, y0_, sill, o1, y1_, sill + bw), (o0, y0_, head - bw, o1, y1_, head)]
                    if o1 - o0 > 1.5: bars.append(((o0 + o1) / 2 - bw / 2, y0_, sill, (o0 + o1) / 2 + bw / 2, y1_, head))
                    gb = (o0 + bw, pos - 0.05, sill + bw, o1 - bw, pos + 0.05, head - bw)
                else:
                    x0_, x1_ = pos - 0.09, pos + 0.09
                    bars = [(x0_, o0, sill, x1_, o0 + bw, head), (x0_, o1 - bw, sill, x1_, o1, head), (x0_, o0, sill, x1_, o1, sill + bw), (x0_, o0, head - bw, x1_, o1, head)]
                    if o1 - o0 > 1.5: bars.append((x0_, (o0 + o1) / 2 - bw / 2, sill, x1_, (o0 + o1) / 2 + bw / 2, head))
                    gb = (pos - 0.05, o0 + bw, sill + bw, pos + 0.05, o1 - bw, head - bw)
                els.append(dict(box=gb, kind="glass", t0=tt, dur=0.3, anim="fade", col=GLASS, col2=GLASS))
                for bb in bars: els.append(dict(box=bb, kind="frame", t0=tt + 0.05, dur=0.25, anim="fade", col=FRAME, col2=FRAME))
    return els
ELS = build_elements()
TREES = [(-1.8, 1.0, 1.0, 9.0), (11.4, 1.2, 1.15, 9.15), (10.8, 8.6, 0.9, 9.3), (-1.4, 8.2, 1.05, 9.4), (0.8, 7.9, 0.45, 9.55), (7.8, 8.2, 0.5, 9.6), (11.8, 5.8, 0.6, 9.7)]
CHIPS = [("ALVENARIA", 6.1, (0.0, 3.5, 1.4)), ("LAJE", 7.0, (10.3, 0.0, 3.0)), ("ACABAMENTO", 7.85, (5.0, 7.3, 2.0)),
         ("ESQUADRIAS", 8.7, (3.6, 7.1, 1.2)), ("PAISAGISMO", 9.55, (11.4, 1.2, 2.2))]

def cam(t):
    if t < T0: return 0.0, 90.0, 80.0
    p = easeio((t - T0) / 0.9); e = lerp(90, 36, p); yaw = lerp(0, 32, p) + max(0, t - 6.6) * 13.0; S = lerp(80, 50, p)
    return yaw, e, S

class View:
    def __init__(self, yaw, e, S):
        self.c, self.s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw)); self.ce, self.se = math.cos(math.radians(e)), math.sin(math.radians(e)); self.S = S
        self.ox, self.oy = 500.0, 352.0 + (0 if e >= 89 else 22)
    def pr(self, x, y, z):
        x -= 5.0; y -= 3.5; z -= 1.0
        xr = x * self.c - y * self.s; yr = x * self.s + y * self.c
        return (self.ox + xr * self.S, self.oy + (yr * self.se - z * self.ce) * self.S, yr * self.ce + z * self.se)
    def vis(self, n):
        nx, ny, nz = n; nyr = nx * self.s + ny * self.c
        return nyr * self.ce + nz * self.se > 1e-6

def shade(col, n, boost=1.0):
    s = 0.68 + 0.36 * max(0.0, float(np.dot(n, LIGHT))); return tuple(min(255, int(c * s * boost)) for c in col)

FACES = [((1, 0, 0), lambda b: [(b[3], b[1], b[2]), (b[3], b[4], b[2]), (b[3], b[4], b[5]), (b[3], b[1], b[5])]),
         ((-1, 0, 0), lambda b: [(b[0], b[4], b[2]), (b[0], b[1], b[2]), (b[0], b[1], b[5]), (b[0], b[4], b[5])]),
         ((0, 1, 0), lambda b: [(b[3], b[4], b[2]), (b[0], b[4], b[2]), (b[0], b[4], b[5]), (b[3], b[4], b[5])]),
         ((0, -1, 0), lambda b: [(b[0], b[1], b[2]), (b[3], b[1], b[2]), (b[3], b[1], b[5]), (b[0], b[1], b[5])]),
         ((0, 0, 1), lambda b: [(b[0], b[1], b[5]), (b[3], b[1], b[5]), (b[3], b[4], b[5]), (b[0], b[4], b[5])])]

def render3d(t):
    yaw, e, S = cam(t); v = View(yaw, e, S); k = 2
    im = Image.new("RGBA", (RW * k, RH * k), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
    paint_p = ease((t - 7.45) / 0.6); grass_p = ease((t - 8.6) / 0.4)
    def Q(pts): return [(x * k, y * k) for x, y, _ in [v.pr(*p) for p in pts]]
    # chão
    if grass_p > 0:
        def disk(rx, ry, z, col, al):
            pts = [(5 + rx * math.cos(a_), 3.5 + ry * math.sin(a_), z) for a_ in np.linspace(0, 2 * math.pi, 72)]
            d.polygon(Q(pts), fill=col + (int(al * grass_p),))
        disk(9.2, 8.0, -0.75, (40, 70, 40), 255)      # lateral do bloco de terreno
        disk(9.0, 7.8, -0.3, (74, 128, 62), 255)
        disk(7.4, 6.5, -0.29, (86, 142, 70), 255)
        disk(6.0, 5.4, -0.28, (96, 152, 78), 255)
        wp = ease((t - 8.8) / 0.35)
        if wp > 0:
            d.polygon(Q([(3.0, 7.0, -0.27), (4.2, 7.0, -0.27), (4.2, 7.0 + 3.6 * wp, -0.27), (3.0, 7.0 + 3.6 * wp, -0.27)]), fill=(214, 214, 218, 255))
    # base/pavimento
    if t > T0 - 0.6:
        a = int(255 * min(1, (t - (T0 - 0.6)) / 0.3))
        faces = []
        b0 = (-0.3, -0.3, -0.3, 10.3, 7.3, 0.0)
        # sombra
        hmax = 0.0
        for el in ELS:
            pr_ = easeio((t - el["t0"]) / el["dur"]) if el["anim"] != "fade" else 0
            if el["kind"] in ("wall", "slab"): hmax = max(hmax, el["box"][5] * (1 if el["anim"] == "drop" and pr_ > 0 else min(1, max(0, (t - el["t0"]) / el["dur"]))))
        if hmax > 0.1 and grass_p > 0:
            dx, dy = hmax * 0.30, hmax * 0.22
            pts = [(-0.3, -0.3), (10.3, -0.3), (10.3, 7.3), (-0.3, 7.3), (-0.3 + dx, -0.3 + dy), (10.3 + dx, -0.3 + dy), (10.3 + dx, 7.3 + dy), (-0.3 + dx, 7.3 + dy)]
            hull = cv2.convexHull(np.array([(p[0] * 100, p[1] * 100) for p in pts], np.float32)).reshape(-1, 2) / 100.0
            d.polygon([(x * k, y * k) for x, y, _ in [v.pr(px, py, -0.27) for px, py in hull]], fill=(20, 60, 25, int(55 * grass_p)))
    items = []   # (profundidade, tipo, dados)
    def add_box(box, col, kind, alpha=255, brick=0.0, wall=False):
        for n, fn in FACES:
            if not v.vis(n): continue
            if kind == 'tile' and n[2] != 1: continue
            if kind == 'slab' and n[2] == 1: continue
            if wall and slab_on and n[2] == 1 and box[5] <= HW + 0.01: continue
            pts = [v.pr(*p) for p in fn(box)]
            dep = sum(p[2] for p in pts) / 4
            items.append((dep, "poly", dict(pts=pts, col=shade(col, n, 1.06 if kind == "glass" else 1.0), a=alpha, n=n, brick=brick, wall=wall, box=box, kind=kind)))
    # piso (laje de fundação)
    add_box((-0.3, -0.3, -0.3, 10.3, 7.3, 0.0), mix((160, 162, 168), CONC, 0.5), "base", int(255 * min(1, max(0, (t - (T0 - 0.6)) / 0.3))))
    if t < T0 + 0.3:  # piso interno claro na fase de planta
        add_box((0.1, 0.1, 0.0, 9.9, 6.9, 0.02), (214, 206, 190), "base", 255)
    slab_on = t > 6.9 + 0.45
    for el in ELS:
        x0, y0, z0, x1, y1, z1 = el["box"]; p = (t - el["t0"]) / el["dur"]
        if p <= 0: continue
        if slab_on and el.get("interior"): continue
        pe = ease(p)
        if el["anim"] == "grow": z1_ = z0 + (z1 - z0) * pe; box = (x0, y0, z0, x1, y1, max(z0 + 0.001, z1_))
        elif el["anim"] == "drop": dz = (1 - pe) * 2.2; box = (x0, y0, z0 + dz, x1, y1, z1 + dz)
        else: box = el["box"]
        alpha = int(255 * (min(1, p * 1.4) if el["anim"] == "fade" else 1))
        if el["kind"] == "glass": alpha = int(215 * min(1, p * 1.4))
        col = mix(el["col"], el["col2"], paint_p) if el["kind"] in ("wall", "slab", "tile") else el["col"]
        add_box(box, col, el["kind"], alpha, brick=(1 - paint_p) if el["kind"] == "wall" else 0.0, wall=el["kind"] == "wall")
    # árvores
    for (tx, ty, sc, t0_) in TREES:
        p = back((t - t0_) / 0.4)
        if t > t0_: x_, y_, dep = v.pr(tx, ty, 0); items.append((dep, "tree", dict(x=x_, y=y_, s=sc * p * S / 50)))
    items.sort(key=lambda z: z[0])
    for dep, tp, dt in items:
        if tp == "poly":
            pts = [(x * k, y * k) for x, y, _ in dt["pts"]]; c = dt["col"] + (dt["a"],)
            if dt["kind"] == "glass":
                c = (130, 190, 225, dt["a"])
            ol = (tuple(int(q * 0.62) for q in dt["col"]) if dt["kind"] != "tile" else dt["col"]) + (dt["a"],)
            d.polygon(pts, fill=c); d.line(pts + [pts[0]], fill=ol, width=(1 if dt["kind"] == "tile" else 2 * k if dt["kind"] != "base" else 3))
            if dt["wall"] and dt["brick"] > 0.02 and dt["n"][2] == 0:
                P0, P1, P2, P3 = pts   # P0,P1 base; P3,P2 topo
                b = dt["box"]; hz = b[5] - b[2]; nl = int(hz / 0.25)
                for i in range(1, nl + 1):
                    f_ = i / (nl + 1)
                    A = (P0[0] + (P3[0] - P0[0]) * f_, P0[1] + (P3[1] - P0[1]) * f_); B = (P1[0] + (P2[0] - P1[0]) * f_, P1[1] + (P2[1] - P1[1]) * f_)
                    d.line([A, B], fill=(120, 60, 40, int(120 * dt["brick"])), width=1 * k)
            if dt["kind"] == "solar" and dt["n"][2] == 1:
                P0, P1, P2, P3 = pts
                for i in range(1, 6):
                    f_ = i / 6; A = (P0[0] + (P1[0] - P0[0]) * f_, P0[1] + (P1[1] - P0[1]) * f_); B = (P3[0] + (P2[0] - P3[0]) * f_, P3[1] + (P2[1] - P3[1]) * f_)
                    d.line([A, B], fill=(150, 185, 235, 160), width=1 * k)
                for i in range(1, 3):
                    f_ = i / 3; A = (P0[0] + (P3[0] - P0[0]) * f_, P0[1] + (P3[1] - P0[1]) * f_); B = (P1[0] + (P2[0] - P1[0]) * f_, P1[1] + (P2[1] - P1[1]) * f_)
                    d.line([A, B], fill=(150, 185, 235, 160), width=1 * k)
            if dt["kind"] == "glass" and dt["n"][2] == 0:
                P0, P1, P2, P3 = pts
                mid = lambda a, b, f: (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
                d.polygon([mid(P0, P1, 0.15), mid(P0, P1, 0.45), mid(P3, P2, 0.45), mid(P3, P2, 0.15)], fill=(255, 255, 255, 60))
        else:
            x_, y_, s = dt["x"] * k, dt["y"] * k, dt["s"] * k
            if s < 2: continue
            d.polygon([(x_ - 6 * s, y_), (x_ + 6 * s, y_), (x_ + 4 * s, y_ - 40 * s), (x_ - 4 * s, y_ - 40 * s)], fill=(110, 76, 48, 255))
            for (dx, dy, r, c) in ((-18, -62, 30, (44, 112, 52)), (18, -66, 30, (52, 124, 58)), (0, -88, 34, (66, 142, 66)), (-4, -60, 26, (58, 130, 60))):
                d.ellipse((x_ + (dx - r) * s, y_ + (dy - r) * s, x_ + (dx + r) * s, y_ + (dy + r) * s), fill=c + (255,))
            d.ellipse((x_ + (-8 - 10) * s, y_ + (-96 - 10) * s, x_ + (-8 + 10) * s, y_ + (-96 + 10) * s), fill=(120, 176, 90, 255))
    out = np.array(im.resize((RW, RH), Image.LANCZOS))
    return out, v

def chips_overlay(t, v):
    """etiquetas com linha de chamada ancoradas no modelo"""
    k = 2; im = Image.new("RGBA", (RW * k, RH * k), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA"); f = F(34 * k)
    for (nm, ts, anchor) in CHIPS:
        tl = t - ts
        if tl < 0 or tl > 0.85: continue
        pin = back(tl / 0.25); pout = max(0.0, (tl - 0.65) / 0.2)
        a = int(255 * min(1, tl / 0.12) * (1 - pout))
        ax, ay, _ = v.pr(*anchor)
        right = ax < RW / 2
        bx = min(max(ax + (150 if right else -150), 120), RW - 120); by = max(60, ay - 110)
        w_ = d.textlength(nm, font=f); cw, ch = w_ + 44 * k / k * 1.0, 62
        x0, y0 = bx - w_ / 2 - 22, by - ch / 2
        sc = max(0.05, pin)
        # linha de chamada
        d.line([(ax * k, ay * k), (bx * k, by * k)], fill=YEL + (a,), width=3 * k)
        r = 9 + 6 * ((tl * 3) % 1)
        d.ellipse(((ax - 7) * k, (ay - 7) * k, (ax + 7) * k, (ay + 7) * k), fill=YEL + (a,)); d.ellipse(((ax - r) * k, (ay - r) * k, (ax + r) * k, (ay + r) * k), outline=YEL + (int(a * 0.6),), width=2 * k)
        cx = bx; wc, hc = (w_ + 44) * sc, ch * sc
        d.rounded_rectangle(((cx - wc / 2) * k, (by - hc / 2) * k, (cx + wc / 2) * k, (by + hc / 2) * k), int(14 * k * sc), fill=(255, 255, 255, a))
        if sc > 0.6: d.text((cx * k - w_ / 2 * sc, (by - 20 * sc) * k), nm, font=F(int(34 * k * sc)), fill=DARK + (a,))
    return np.array(im.resize((RW, RH), Image.LANCZOS))

def illustration(t):
    """RGBA 1000x705 da ilustração no tempo t (s do vídeo)"""
    if t < 4.2: return None
    if t < T0 + 0.25:
        pl = plan_cad((t - 4.2) * 1.6)
        if t < T0 - 0.15: return pl
        a3, _ = render3d(t)
        q = (t - (T0 - 0.15)) / 0.4
        out = pl.astype(np.float32); out[..., 3] *= (1 - q)
        o3 = a3.astype(np.float32); o3[..., 3] *= q
        return _over(out, o3)
    r, v = render3d(t)
    ch = chips_overlay(t, v)
    return _over(r.astype(np.float32), ch.astype(np.float32))

def _over(a, b):
    aa, ba = a[..., 3:4] / 255.0, b[..., 3:4] / 255.0; oa = ba + aa * (1 - ba)
    rgb = (b[..., :3] * ba + a[..., :3] * aa * (1 - ba)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], axis=2).astype(np.uint8)
