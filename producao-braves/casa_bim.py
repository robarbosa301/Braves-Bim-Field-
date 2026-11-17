"""Modelo BIM multidisciplinar: estrutura, arquitetura, hidrossanitário, elétrica e compatibilização.
Dois projetos diferentes (A: térreo com laje; B: com telhado de duas águas). Uso: render(u, "A"|"B") -> RGBA 1000x705."""
import math, importlib.util
import numpy as np, cv2
from PIL import Image, ImageDraw

BASE = "BASE_AQUI/"
_sp = importlib.util.spec_from_file_location("casa", BASE + "casa.py"); C = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(C)
ease, easeio, back, lerp, mix = C.ease, C.easeio, C.back, C.lerp, C.mix
RW, RH = 1000, 705
HW = 2.8
EXT, INT = 0.22, 0.14
BRICK, CONC, GLASS, FRAME, WOOD, GRAPH = C.BRICK, C.CONC, C.GLASS, C.FRAME, C.WOOD, C.GRAPH
WATER, SEWER, ELEC, CLASH, OKG = (40, 150, 255), (150, 104, 64), (255, 176, 0), (235, 40, 40), (40, 200, 120)

# ------------------------------------------------------------------ projetos
WALLS_A = C.WALLS
WALLS_B = [
    ("x", 0.0, 0.0, 11.0, EXT, [(1.5, 3.5, 0.9, 2.1), (7.5, 9.5, 0.9, 2.1)]),
    ("x", 8.0, 0.0, 11.0, EXT, [(2.0, 3.2, 0.0, 2.2), (5.0, 8.0, 0.9, 2.1), (9.5, 10.4, 1.5, 2.1)]),
    ("y", 0.0, 0.0, 8.0, EXT, [(1.5, 3.0, 0.9, 2.1), (5.0, 7.0, 0.9, 2.1)]),
    ("y", 11.0, 0.0, 8.0, EXT, [(1.5, 3.0, 0.9, 2.1)]),
    ("x", 5.0, 0.0, 6.0, INT, [(1.0, 1.9, 0.0, 2.1)]),
    ("y", 6.0, 0.0, 5.0, INT, [(2.5, 3.4, 0.0, 2.1)]),
    ("x", 5.0, 6.0, 11.0, INT, [(7.0, 7.9, 0.0, 2.1)]),
    ("y", 8.0, 5.0, 8.0, INT, [(5.6, 6.5, 0.0, 2.1)]),
]
MODELS = {
    "A": dict(W=10.0, D=7.0, walls=WALLS_A, roof="laje", paint=C.PAINT, roofcol=(232, 232, 236), accent=GRAPH, beam_line=4.0, quadro=(4.65, 6.9),
              wc=(9.4, 4.7), lav=(8.35, 6.6), chu=(9.35, 6.2), counter=(5.3, 6.35, 0.0, 6.9, 6.86, 0.9), pia=(6.1, 6.6), maq=(4.55, 6.6), tanque=None,
              tank_mode="roof", tank=(9.1, 5.4), prumada=(9.9, 4.3), cg=(6.1, 7.85), ci=(8.9, 7.85), rede=(11.6, 7.85),
              tags=[("BANHEIRO", (8.75, 5.4)), ("COZINHA", (6.1, 5.4))],
              luzes=[(2.5, 2.0), (7.5, 2.0), (2.0, 5.5), (6.0, 5.5), (8.7, 5.5)], tomadas=[(0.25, 2.5), (9.75, 2.2), (0.25, 5.8), (5.2, 6.8)]),
    "B": dict(W=11.0, D=8.0, walls=WALLS_B, roof="duas_aguas", paint=(238, 226, 208), roofcol=(190, 92, 60), accent=(116, 96, 80), beam_line=5.0, quadro=(4.0, 7.85),
              wc=(10.4, 5.7), lav=(9.2, 7.4), chu=(10.4, 7.3), counter=(5.2, 7.35, 0.0, 7.4 + 0.0 + 0.0 + 0.0 + 0.0, 7.86, 0.9), pia=(6.3, 7.6), maq=None, tanque=(3.9, 7.6),
              tank_mode="tower", tank=(12.0, 6.2), prumada=(10.8, 6.2), cg=(6.3, 8.8), ci=(9.4, 8.8), rede=(12.2, 8.8),
              tags=[("BANHEIRO", (9.6, 6.4)), ("COZINHA", (6.3, 6.3)), ("ÁREA DE SERVIÇO", (3.9, 6.3))],
              luzes=[(3.0, 2.5), (8.5, 2.5), (3.0, 6.6), (8.5, 6.5)], tomadas=[(0.25, 3.0), (10.75, 3.0), (0.25, 6.5), (6.8, 7.8)]),
}
MODELS["B"]["counter"] = (5.2, 7.35, 0.0, 7.4, 7.86, 0.9)
MODELS["B"]["counter"] = (5.2, 7.35, 0.0, 7.4, 7.86, 0.9)

def box_t(p0, p1, th):
    return (min(p0[0], p1[0]) - th / 2, min(p0[1], p1[1]) - th / 2, min(p0[2], p1[2]) - th / 2,
            max(p0[0], p1[0]) + th / 2, max(p0[1], p1[1]) + th / 2, max(p0[2], p1[2]) + th / 2)

# ------------------------------------------------------------------ cronograma (segundos "u" do modelo)
TL = dict(found=0.0, cols=0.3, beams=1.0, slab=1.8, walls=2.2, paint=3.4, openings=3.8, explode=4.4, water=4.8, sewer=5.5, elec=6.6, clash=8.0, resolve=9.3, back=10.3)

def build(key):
    m = MODELS[key]; els = []
    # fundação (baldrame)
    els.append(dict(box=(-0.3, -0.3, -0.3, m["W"] + 0.3, m["D"] + 0.3, 0.0), kind="found", t0=TL["found"], dur=0.5, anim="fade", col=(176, 178, 184)))
    # colunas e vigas (estrutura em concreto)
    pts = set()
    for (ax, pos, a0, a1, th, ops) in m["walls"]:
        for p in (a0, a1): pts.add((round(p, 2), round(pos, 2)) if ax == "x" else (round(pos, 2), round(p, 2)))
    for k_, (px, py) in enumerate(sorted(pts)):
        els.append(dict(box=(px - 0.13, py - 0.13, 0.0, px + 0.13, py + 0.13, HW), kind="col", t0=TL["cols"] + 0.05 * k_, dur=0.5, anim="grow", col=(150, 154, 162)))
    for k_, (ax, pos, a0, a1, th, ops) in enumerate(m["walls"]):
        bx = (a0, pos - 0.11, 2.4, a1, pos + 0.11, HW) if ax == "x" else (pos - 0.11, a0, 2.4, pos + 0.11, a1, HW)
        els.append(dict(box=bx, kind="beam", t0=TL["beams"] + 0.07 * k_, dur=0.4, anim="drop", col=(168, 172, 180)))
    # paredes
    n = 0
    for w in m["walls"]:
        for b in C.wall_boxes(w):
            x0, y0, z0, x1, y1, z1, tp = b
            els.append(dict(box=(x0, y0, z0, x1, y1, min(z1, 2.4) if z1 >= HW else z1), kind="wall", t0=TL["walls"] + 0.012 * n, dur=0.45, anim="grow", col=BRICK, col2=m["paint"])); n += 1
    # aberturas
    q = 0
    for (ax, pos, a0, a1, th_, ops) in m["walls"]:
        if th_ != EXT: continue
        for (o0, o1, sill, head) in ops:
            tt = TL["openings"] + 0.05 * q; q += 1
            if ax == "x": fb = (o0, pos - 0.09, sill, o1, pos + 0.09, head); gb = (o0 + 0.07, pos - 0.05, sill + 0.07, o1 - 0.07, pos + 0.05, head - 0.07)
            else: fb = (pos - 0.09, o0, sill, pos + 0.09, o1, head); gb = (pos - 0.05, o0 + 0.07, sill + 0.07, pos + 0.05, o1 - 0.07, head - 0.07)
            if sill == 0: els.append(dict(box=fb, kind="door", t0=tt, dur=0.35, anim="fade", col=WOOD))
            else:
                els.append(dict(box=gb, kind="glass", t0=tt, dur=0.3, anim="fade", col=GLASS))
                els.append(dict(box=(fb[0], fb[1], fb[2], fb[3], fb[4], fb[2] + 0.07), kind="frame", t0=tt + 0.05, dur=0.25, anim="fade", col=FRAME))
                els.append(dict(box=(fb[0], fb[1], fb[5] - 0.07, fb[3], fb[4], fb[5]), kind="frame", t0=tt + 0.05, dur=0.25, anim="fade", col=FRAME))
    # laje / cobertura (sobe no "explode" e volta no final)
    if m["roof"] == "laje":
        els.append(dict(box=(-0.3, -0.3, 2.8, m["W"] + 0.3, m["D"] + 0.3, 3.05), kind="roof", t0=TL["slab"], dur=0.5, anim="drop", col=m["roofcol"]))
    else:
        els.append(dict(kind="gable", t0=TL["slab"] + 0.6, dur=0.6, anim="drop", col=m["roofcol"]))
    # hidrossanitário: lançamento por ambiente (banheiro, cozinha, área de serviço); caixas FORA da casa
    wc, lv, ch, pi_, pr, tk, cg, ci, rd = m["wc"], m["lav"], m["chu"], m["pia"], m["prumada"], m["tank"], m["cg"], m["ci"], m["rede"]
    zW = 2.2; px, py = pr
    def add_seg(a_, b_, th, kind, col, t0, dur=0.35): els.append(dict(seg=(a_, b_), th=th, kind=kind, t0=t0, dur=dur, col=col))
    tw = TL["water"]; k_ = 0
    # reservatório (caixa d'água) e prumada
    if m["tank_mode"] == "roof":
        els.append(dict(box=(tk[0] - 0.7, tk[1] - 0.7, 3.05, tk[0] + 0.7, tk[1] + 0.7, 3.95), kind="roof", t0=TL["slab"] + 0.4, dur=0.5, anim="drop", col=(60, 150, 230)))
        add_seg((px, py, 3.05), (px, py, zW), 0.10, "pipe_w", WATER, tw); k_ += 1
        els.append(dict(seg=((tk[0], tk[1], 3.05), (px, tk[1], 3.05)), th=0.10, kind="pipe_w", t0=tw, dur=0.3, col=WATER, ghostless=True))
    else:
        for (dx_, dy_) in ((-0.6, -0.6), (0.6, -0.6), (-0.6, 0.6), (0.6, 0.6)):
            els.append(dict(box=(tk[0] + dx_ - 0.07, tk[1] + dy_ - 0.07, 0.0, tk[0] + dx_ + 0.07, tk[1] + dy_ + 0.07, 2.8), kind="col", t0=TL["slab"] + 0.3, dur=0.5, anim="grow", col=(150, 154, 162)))
        els.append(dict(box=(tk[0] - 0.8, tk[1] - 0.8, 2.8, tk[0] + 0.8, tk[1] + 0.8, 3.9), kind="fixture", t0=TL["slab"] + 0.7, dur=0.4, anim="fade", col=(60, 150, 230)))
        add_seg((tk[0], tk[1], 2.8), (tk[0], tk[1], zW), 0.10, "pipe_w", WATER, tw); add_seg((tk[0], tk[1], zW), (px, tk[1], zW), 0.10, "pipe_w", WATER, tw + 0.2)
        add_seg((px, tk[1], zW), (px, py, zW), 0.10, "pipe_w", WATER, tw + 0.35)
    # ramal do banheiro
    yb = max(wc[1], lv[1], ch[1]); tb = tw + 0.45
    add_seg((px, py, zW), (px, yb, zW), 0.10, "pipe_w", WATER, tb)
    for j, (fx_, fy_, zd) in enumerate(((wc[0], wc[1], 0.5), (lv[0], lv[1], 0.9), (ch[0], ch[1], 1.9))):
        add_seg((px, fy_, zW), (fx_, fy_, zW), 0.10, "pipe_w", WATER, tb + 0.12 * (j + 1)); add_seg((fx_, fy_, zW), (fx_, fy_, zd), 0.10, "pipe_w", WATER, tb + 0.12 * (j + 1) + 0.15)
    # ramal da cozinha (e do tanque)
    tc = tw + 0.9
    add_seg((px, py, zW), (pi_[0], py, zW), 0.10, "pipe_w", WATER, tc, 0.5); add_seg((pi_[0], py, zW), (pi_[0], pi_[1], zW), 0.10, "pipe_w", WATER, tc + 0.3, 0.4); add_seg((pi_[0], pi_[1], zW), (pi_[0], pi_[1], 1.05), 0.10, "pipe_w", WATER, tc + 0.55)
    if m.get("tanque"):
        tq = m["tanque"]; add_seg((pi_[0], pi_[1] - 0.6, zW), (tq[0], pi_[1] - 0.6, zW), 0.10, "pipe_w", WATER, tc + 0.7); add_seg((tq[0], pi_[1] - 0.6, zW), (tq[0], tq[1], zW), 0.10, "pipe_w", WATER, tc + 0.9); add_seg((tq[0], tq[1], zW), (tq[0], tq[1], 1.05), 0.10, "pipe_w", WATER, tc + 1.1)
    # esgoto: cada ambiente vai para a sua caixa, FORA da casa
    zS = 0.14; ts_ = TL["sewer"]
    add_seg((wc[0], wc[1], zS), (ci[0], wc[1], zS), 0.15, "pipe_s", SEWER, ts_); add_seg((lv[0], lv[1], zS), (ci[0], lv[1], zS), 0.12, "pipe_s", SEWER, ts_ + 0.1); add_seg((ch[0], ch[1], zS), (ci[0], ch[1], zS), 0.12, "pipe_s", SEWER, ts_ + 0.2)
    add_seg((ci[0], wc[1], zS), (ci[0], ci[1], zS), 0.15, "pipe_s", SEWER, ts_ + 0.3, 0.5)
    add_seg((pi_[0], pi_[1], zS), (pi_[0], cg[1], zS), 0.12, "pipe_s", SEWER, ts_ + 0.5, 0.4)
    if m.get("tanque"):
        tq = m["tanque"]; add_seg((tq[0], tq[1], zS), (tq[0], cg[1], zS), 0.12, "pipe_s", SEWER, ts_ + 0.55, 0.4); add_seg((tq[0], cg[1], zS), (cg[0], cg[1], zS), 0.12, "pipe_s", SEWER, ts_ + 0.7, 0.3)
    add_seg((cg[0], cg[1], zS), (ci[0], cg[1], zS), 0.14, "pipe_s", SEWER, ts_ + 0.9, 0.4); add_seg((ci[0], ci[1], zS), (rd[0], ci[1], zS), 0.15, "pipe_s", SEWER, ts_ + 1.1, 0.5)
    add_seg((wc[0] + 0.28, wc[1] - 0.15, zS), (wc[0] + 0.28, wc[1] - 0.15, 3.5), 0.08, "pipe_s", SEWER, ts_ + 0.8, 0.5)   # ventilação
    # caixas externas (fora da casa)
    els.append(dict(box=(cg[0] - 0.3, cg[1] - 0.3, -0.25, cg[0] + 0.3, cg[1] + 0.3, 0.2), kind="fixture", t0=ts_ + 0.6, dur=0.35, anim="fade", col=(214, 172, 72)))
    els.append(dict(box=(cg[0] - 0.22, cg[1] - 0.22, 0.2, cg[0] + 0.22, cg[1] + 0.22, 0.26), kind="fixture", t0=ts_ + 0.7, dur=0.3, anim="fade", col=(176, 138, 50)))
    els.append(dict(box=(ci[0] - 0.32, ci[1] - 0.32, -0.25, ci[0] + 0.32, ci[1] + 0.32, 0.2), kind="fixture", t0=ts_ + 0.9, dur=0.35, anim="fade", col=(176, 178, 184)))
    els.append(dict(box=(ci[0] - 0.24, ci[1] - 0.24, 0.2, ci[0] + 0.24, ci[1] + 0.24, 0.26), kind="fixture", t0=ts_ + 1.0, dur=0.3, anim="fade", col=(130, 134, 142)))
    # louças e bancadas por ambiente
    tf = TL["water"] + 1.0; fx = []
    fx += [(wc[0] - 0.22, wc[1] - 0.3, 0.0, wc[0] + 0.22, wc[1] + 0.3, 0.42, (245, 246, 250)), (wc[0] - 0.22, wc[1] - 0.34, 0.42, wc[0] + 0.22, wc[1] - 0.18, 0.95, (230, 232, 240))]
    fx += [(lv[0] - 0.3, lv[1] - 0.22, 0.78, lv[0] + 0.3, lv[1] + 0.22, 0.9, (245, 246, 250)), (lv[0] - 0.08, lv[1] - 0.08, 0.0, lv[0] + 0.08, lv[1] + 0.08, 0.78, (230, 232, 240))]
    fx += [(ch[0] - 0.4, ch[1] - 0.4, 0.0, ch[0] + 0.4, ch[1] + 0.4, 0.06, (200, 206, 214)), (ch[0] - 0.03, ch[1] - 0.03, 0.06, ch[0] + 0.03, ch[1] + 0.03, 1.95, (210, 214, 222)), (ch[0] - 0.13, ch[1] - 0.13, 1.95, ch[0] + 0.13, ch[1] + 0.13, 2.03, (210, 214, 222))]
    fx += [m["counter"] + ((196, 150, 100),), (pi_[0] - 0.35, pi_[1] - 0.2, 0.9, pi_[0] + 0.35, pi_[1] + 0.2, 0.94, (150, 154, 162))]
    if m.get("maq"): mq = m["maq"]; fx += [(mq[0] - 0.3, mq[1] - 0.3, 0.0, mq[0] + 0.3, mq[1] + 0.3, 0.85, (240, 242, 248))]
    if m.get("tanque"): tq = m["tanque"]; fx += [(tq[0] - 0.4, tq[1] - 0.3, 0.0, tq[0] + 0.4, tq[1] + 0.3, 0.85, (200, 214, 226)), (tq[0] - 0.3, tq[1] - 0.2, 0.85, tq[0] + 0.3, tq[1] + 0.2, 0.9, (150, 154, 162))]
    for j, f in enumerate(fx): els.append(dict(box=f[:6], kind="fixture", t0=tf + 0.09 * j, dur=0.3, anim="fade", col=f[6]))
    # elétrica
    qx, qy = m["quadro"]; zE = 2.65; ys = [l[1] for l in m["luzes"]]; y_end = min(ys) - 0.2
    els.append(dict(box=(qx - 0.2, qy - 0.06, 1.1, qx + 0.2, qy + 0.06, 1.7), kind="quadro", t0=TL["elec"], dur=0.35, anim="fade", col=(170, 174, 182)))
    yc = m["beam_line"]
    trunk_straight = [((qx, qy, 1.7), (qx, qy, zE)), ((qx, qy, zE), (qx, y_end, zE))]
    trunk_dip = [((qx, qy, 1.7), (qx, qy, zE)), ((qx, qy, zE), (qx, yc + 0.8, zE)), ((qx, yc + 0.8, zE), (qx, yc + 0.8, 2.12)), ((qx, yc + 0.8, 2.12), (qx, yc - 0.8, 2.12)),
                 ((qx, yc - 0.8, 2.12), (qx, yc - 0.8, zE)), ((qx, yc - 0.8, zE), (qx, y_end, zE))]
    for k_, (a, b) in enumerate(trunk_straight): els.append(dict(seg=(a, b), th=0.07, kind="elec_s", t0=TL["elec"] + 0.2 + 0.3 * k_, dur=0.5, col=ELEC, until=TL["resolve"]))
    for k_, (a, b) in enumerate(trunk_dip): els.append(dict(seg=(a, b), th=0.07, kind="elec_d", t0=TL["resolve"] + 0.08 * k_, dur=0.3, col=ELEC, instant=True))
    for k_, (lx, ly) in enumerate(m["luzes"]):
        tt = TL["elec"] + 0.9 + 0.18 * k_
        if abs(lx - qx) > 0.05: els.append(dict(seg=((qx, ly, zE), (lx, ly, zE)), th=0.07, kind="elec_b", t0=tt, dur=0.4, col=ELEC))
        els.append(dict(box=(lx - 0.16, ly - 0.16, 2.62, lx + 0.16, ly + 0.16, 2.72), kind="light", t0=tt + 0.35, dur=0.3, anim="fade", col=(255, 240, 170)))
    for k_, (tx, ty) in enumerate(m["tomadas"]):
        tt = TL["elec"] + 1.6 + 0.15 * k_
        els.append(dict(box=(tx - 0.06, ty - 0.06, 0.25, tx + 0.06, ty + 0.06, 0.4), kind="socket", t0=tt, dur=0.25, anim="fade", col=(255, 210, 60)))
        els.append(dict(seg=((tx, ty, 0.4), (tx, ty, zE)), th=0.05, kind="elec_b", t0=tt, dur=0.4, col=ELEC))
    return els
ELS = {k: build(k) for k in MODELS}

# ------------------------------------------------------------------ projeção
class VW:
    def __init__(self, yaw, e, S, cx, cy):
        self.c, self.s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw)); self.ce, self.se = math.cos(math.radians(e)), math.sin(math.radians(e)); self.S = S
        self.cx, self.cy = cx, cy; self.ox, self.oy = 500.0, 378.0
    def pr(self, x, y, z):
        x -= self.cx; y -= self.cy; z -= 1.0
        xr = x * self.c - y * self.s; yr = x * self.s + y * self.c
        return (self.ox + xr * self.S, self.oy + (yr * self.se - z * self.ce) * self.S, yr * self.ce + z * self.se)
    def vis(self, n):
        nx, ny, nz = n; nyr = nx * self.s + ny * self.c; return nyr * self.ce + nz * self.se > 1e-6

def ghost_alpha(u):
    """paredes viram fantasma durante hidrossanitário e elétrica"""
    return 1 - 0.78 * ease((u - TL["explode"]) / 0.5) + 0.58 * ease((u - TL["back"]) / 0.6)

def roof_state(u):
    """(deslocamento_z, alpha) da laje/telhado: sobe e some no 'explode', volta no final"""
    lift = ease((u - TL["explode"]) / 0.6) - ease((u - TL["back"]) / 0.7)
    return lift * 2.4, 1 - 0.97 * lift

ZOOM = 1.0
FONT_B = "BASE_AQUI/fontes/Montserrat.ttf"
def render(u, key="A", yaw0=32.0):
    m = MODELS[key]; els = ELS[key]; W_, D_ = m["W"], m["D"]
    S = ZOOM * 800.0 / ((W_ + D_) * 0.866)
    v = VW(yaw0 + u * 8.5, 36.0, S, W_ / 2 - 1.0, D_ / 2 + 0.9); k = 2
    im = Image.new("RGBA", (RW * k, RH * k), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
    # terreno
    def disk(rx, ry, z, col):
        pts = [(W_ / 2 + rx * math.cos(a_), D_ / 2 + ry * math.sin(a_), z) for a_ in np.linspace(0, 2 * math.pi, 72)]
        d.polygon([(x * k, y * k) for x, y, _ in [v.pr(*p) for p in pts]], fill=col + (255,))
    g = ease(u / 0.6)
    if g > 0:
        R = max(W_, D_) * 0.92
        disk(R, R * 0.82, -0.75, (40, 70, 40)); disk(R * 0.98, R * 0.8, -0.3, (74, 128, 62)); disk(R * 0.8, R * 0.66, -0.29, (86, 142, 70)); disk(R * 0.6, R * 0.5, -0.28, (96, 152, 78))
    items = []
    ga = ghost_alpha(u); rz, ra = roof_state(u); paint_p = ease((u - TL["paint"]) / 0.6)
    def add_box(box, col, kind, alpha=255, edge=True, lines=False):
        for n_, fn in C.FACES:
            if not v.vis(n_): continue
            pts = [v.pr(*p) for p in fn(box)]
            items.append((sum(p[2] for p in pts) / 4, "poly", dict(pts=pts, col=C.shade(col, n_, 1.0), a=alpha, edge=edge, n=n_, kind=kind, box=box)))
    for el in els:
        p = (u - el["t0"]) / el["dur"]
        if p <= 0: continue
        kd = el["kind"]
        if kd == "gable":
            if m["roof"] != "duas_aguas": continue
            alpha = int(255 * ra * min(1, p * 1.5));
            if alpha < 4: continue
            dz = rz + (1 - ease(p)) * 2.0 if rz < 0.01 else rz
            # telhado de duas águas ao longo de x: beiral 0.5, cumeeira a 1.35 m
            o = 0.55; x0, x1, y0, y1, yr = -o, W_ + o, -o, D_ + o, D_ / 2; zE, zR = HW + dz + 0.1, HW + dz + 1.5
            faces = [((0, -0.45, 0.9), [(x0, y0, zE), (x1, y0, zE), (x1, yr, zR), (x0, yr, zR)]), ((0, 0.45, 0.9), [(x0, y1, zE), (x1, y1, zE), (x1, yr, zR), (x0, yr, zR)]),
                     ((-1, 0, 0), [(x0 + o, 0, HW + dz), (x0 + o, D_, HW + dz), (x0 + o, yr, zR - 0.1)]), ((1, 0, 0), [(x1 - o, 0, HW + dz), (x1 - o, D_, HW + dz), (x1 - o, yr, zR - 0.1)])]
            for nn, ptsw in faces:
                nl = math.sqrt(sum(c_ * c_ for c_ in nn)); nn = tuple(c_ / nl for c_ in nn)
                if not v.vis(nn): continue
                pts = [v.pr(*q) for q in ptsw]
                items.append((sum(q[2] for q in pts) / len(pts), "poly", dict(pts=pts, col=C.shade(el["col"] if len(ptsw) == 4 else (236, 232, 224), nn, 1.0), a=alpha, edge=True, n=nn, kind="roof", box=None)))
            continue
        if "seg" in el:
            a_, b_ = el["seg"]
            if kd == "elec_s" and u >= el["until"]: continue
            if kd == "elec_d" and u < el["t0"]: continue
            pr_ = 1.0 if el.get("instant") else ease(p)
            e_ = tuple(lerp(a_[i], b_[i], pr_) for i in range(3))
            box = box_t(a_, e_, el["th"]); add_box(box, el["col"], "pipe", 255, edge=True); continue
        x0, y0, z0, x1, y1, z1 = el["box"]; pe = ease(p); alpha = 255; col = el.get("col")
        if kd in ("wall",):
            z1_ = z0 + (z1 - z0) * pe; box = (x0, y0, z0, x1, y1, max(z0 + 0.001, z1_)); col = mix(el["col"], el["col2"], paint_p); alpha = int(255 * ga)
        elif kd in ("col", "beam"):
            if el["anim"] == "grow": box = (x0, y0, z0, x1, y1, max(z0 + 0.001, z0 + (z1 - z0) * pe))
            else: dz = (1 - pe) * 1.6; box = (x0, y0, z0 + dz, x1, y1, z1 + dz)
            alpha = 255
        elif kd == "roof":
            dz = (1 - pe) * 2.0 if rz < 0.01 else 0.0; box = (x0, y0, z0 + dz + rz, x1, y1, z1 + dz + rz); alpha = int(255 * ra)
        elif kd in ("door", "glass", "frame"):
            box = el["box"]; alpha = int((215 if kd == "glass" else 255) * min(1, p * 1.4) * (ga if kd != "frame" else max(ga, 0.4)))
        else:
            box = el["box"]; alpha = int(255 * min(1, p * 1.5))
        if alpha < 4: continue
        add_box(box, col, kd, alpha)
    # marcador de conflito (compatibilização)
    qx, qy = m["quadro"]; yc = m["beam_line"]
    cp = (u - TL["clash"]) / 0.4
    if cp > 0 and u < TL["resolve"] + 0.9:
        resolved = u >= TL["resolve"]; pulse = 0.5 + 0.5 * math.sin(u * 14)
        ccol = OKG if resolved else CLASH; sz = 0.55 + (0.12 * pulse if not resolved else -0.25 * ease((u - TL["resolve"]) / 0.9))
        alpha = int(150 * min(1, cp) * (1 if not resolved else 1 - ease((u - TL["resolve"] - 0.4) / 0.5)))
        if alpha > 4: add_box((qx - sz, yc - sz, 2.65 - sz, qx + sz, yc + sz, 2.65 + sz), ccol, "clash", alpha, edge=True)
    # laje e telhado sempre por último (cobrem o que está abaixo)
    items = [((it[0] + 60) if it[2].get("kind") == "roof" else it[0], it[1], it[2]) for it in items]
    items.sort(key=lambda z_: z_[0])
    for dep, tp, dt in items:
        pts = [(x * k, y * k) for x, y, _ in dt["pts"]]; c = dt["col"] + (dt["a"],)
        if dt["kind"] == "glass": c = (130, 190, 225, dt["a"])
        ol = tuple(int(q * 0.55) for q in dt["col"]) + (min(255, dt["a"] + 40),); wd = 2 * k if dt["kind"] not in ("pipe",) else 3
        if dt["a"] >= 250:
            d.polygon(pts, fill=c)
            if dt["edge"]: d.line(pts + [pts[0]], fill=ol, width=wd)
        else:   # translúcido: mistura de verdade com o que já foi desenhado
            xs = [p_[0] for p_ in pts]; ys = [p_[1] for p_ in pts]
            x0, y0 = int(max(0, min(xs) - 6)), int(max(0, min(ys) - 6)); x1, y1 = int(min(RW * k, max(xs) + 6)), int(min(RH * k, max(ys) + 6))
            if x1 <= x0 or y1 <= y0: continue
            tmp = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0)); td = ImageDraw.Draw(tmp); loc = [(x - x0, y - y0) for x, y in pts]
            td.polygon(loc, fill=c)
            if dt["edge"]: td.line(loc + [loc[0]], fill=ol, width=wd)
            im.alpha_composite(tmp, (x0, y0))
            continue
        if dt["kind"] == "wall" and paint_p < 0.95 and dt["n"][2] == 0:
            P0, P1, P2, P3 = pts; hz = dt["box"][5] - dt["box"][2]; nl = int(hz / 0.25); lc = tuple(int(lerp(a_, b_, 0.45 * (1 - paint_p))) for a_, b_ in zip(dt["col"], (120, 60, 40))) + (255,)
            for i in range(1, nl + 1):
                f_ = i / (nl + 1); A = (P0[0] + (P3[0] - P0[0]) * f_, P0[1] + (P3[1] - P0[1]) * f_); B = (P1[0] + (P2[0] - P1[0]) * f_, P1[1] + (P2[1] - P1[1]) * f_)
                d.line([A, B], fill=lc, width=1 * k)
    # legendas por ambiente / instalações
    if TL["water"] + 0.2 < u < TL["clash"] + 0.3:
        from PIL import ImageFont
        fo = ImageFont.truetype(FONT_B, 15 * k); fo.set_variation_by_axes([800]) if hasattr(fo, "set_variation_by_axes") else None
        la = min(1, (u - TL["water"] - 0.2) / 0.4) * min(1, (TL["clash"] + 0.3 - u) / 0.4)
        L = [(t_, (p_[0], p_[1], 0.2), (60, 150, 230)) for t_, p_ in m["tags"]]
        L += [("CAIXA D'ÁGUA", (m["tank"][0], m["tank"][1], 4.3 if m["tank_mode"] == "roof" else 4.2), (60, 150, 230)),
              ("C. DE GORDURA (FORA)", (m["cg"][0], m["cg"][1], 0.9), (214, 150, 40)), ("C. INSPEÇÃO (FORA)", (m["ci"][0] + 0.4, m["ci"][1] + 0.6, 0.9), (150, 154, 164))]
        for t_, p3, col in L:
            x_, y_, _ = v.pr(*p3); x_ *= k; y_ *= k; bb = d.textbbox((0, 0), t_, font=fo); w_, h_ = bb[2] - bb[0], bb[3] - bb[1]
            tmp = Image.new("RGBA", (w_ + 24 * k, h_ + 16 * k), (0, 0, 0, 0)); td = ImageDraw.Draw(tmp)
            td.rounded_rectangle((0, 0, tmp.width - 1, tmp.height - 1), 8 * k, fill=(9, 22, 52, int(235 * la)), outline=col + (int(255 * la),), width=2 * k)
            td.text((12 * k - bb[0], 8 * k - bb[1]), t_, font=fo, fill=(255, 255, 255, int(255 * la)))
            im.alpha_composite(tmp, (int(max(0, min(RW * k - tmp.width, x_ - tmp.width / 2))), int(max(0, y_ - tmp.height))))
    out = np.array(im.resize((RW, RH), Image.LANCZOS))
    return out

# etiquetas das disciplinas: (texto, cor, u de entrada)
DISCIPLINES = [("ESTRUTURA", (170, 176, 190), TL["cols"]), ("ARQUITETURA", (255, 140, 80), TL["walls"]), ("HIDROSSANITÁRIO", WATER, TL["water"]), ("ELÉTRICA", ELEC, TL["elec"])]
