"""Gera montar_game.py: versão em estilo jogo de mundo aberto (pôr do sol, interface de missão) do vídeo da reunião."""
BASE = "/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"
s = open(BASE + "montar_reuniao.py").read()
def rep(a, b):
    global s
    if a not in s: print("FALTOU:", a[:80]); return
    s = s.replace(a, b, 1)

# ---- paleta: ciano vira rosa-choque, azul vira roxo ----
rep("YEL, WHITE, CYAN, RED, DARK, NAVY = (255, 196, 0), (255, 255, 255), (0, 229, 255), (225, 6, 0), (20, 20, 24), (9, 22, 52)",
    "YEL, WHITE, CYAN, RED, DARK, NAVY = (255, 190, 60), (255, 255, 255), (255, 64, 140), (225, 6, 0), (24, 8, 40), (34, 12, 60)")
rep("zip((14, 34, 78), (5, 12, 32))", "zip((78, 24, 104), (26, 8, 46))")
rep("d.text((x, 52), t, font=f, fill=DARK + (255,))", "d.text((x, 52), t, font=f, fill=WHITE + (255,))")
rep('OUTNAME = V2 + "reuniao_semaudio.mp4"', 'OUTNAME = V2 + "game_semaudio.mp4"'); rep('"tempos_reuniao.json"', '"tempos_game.json"')

# ---- cor de pôr do sol aplicada a todo o filme ----
helpers_game = r'''
from PIL import ImageFilter
# ================= ESTILO JOGO DE MUNDO ABERTO =================
PINK_, ORG_, PURP_ = np.array((255, 64, 140), np.float32), np.array((255, 150, 40), np.float32), np.array((90, 30, 140), np.float32)
_xx, _yy2 = np.meshgrid(np.linspace(-1, 1, W), np.linspace(-1, 1, H)); VIGN = np.clip(1 - 0.45 * (_xx ** 2 * 0.6 + _yy2 ** 2 * 0.8), 0.45, 1)[..., None].astype(np.float32)
SKYG = (np.stack([PINK_[c] * (1 - np.linspace(0, 1, H)) * 0.18 * (1 - np.linspace(0, 1, H)) + ORG_[c] * np.linspace(0, 1, H) * 0.18 * (1 - np.linspace(0, 1, H)) for c in range(3)], axis=1))[:, None, :].astype(np.float32)
def sunset_grade(img):
    f = img.astype(np.float32); g = f.mean(axis=2, keepdims=True) / 255.0
    lo = PURP_ * 0.5; mid = PINK_; hi = ORG_ * 1.05 + np.array((0, 40, 40), np.float32)
    gm = np.where(g < 0.5, lo + (mid - lo) * (g / 0.5), mid + (hi - mid) * ((g - 0.5) / 0.5))
    out = f * 0.5 + gm * 0.5; out = np.clip((out - 128) * 1.12 + 136, 0, 255); out = out + SKYG; out = out * VIGN
    small = cv2.resize(np.clip(out - 170, 0, 255), (W // 4, H // 4), interpolation=cv2.INTER_AREA); bl = cv2.resize(cv2.GaussianBlur(small, (0, 0), 7), (W, H))
    return np.clip(out + bl * 0.8, 0, 255).astype(np.uint8)
def _make_sunset_sky(w=760, h=500):
    t = np.linspace(0, 1, h); cols = [np.interp(t, [0, 0.5, 0.85, 1], c) for c in ([70, 200, 255, 255], [22, 50, 150, 190], [110, 140, 70, 60])]
    img = np.stack([np.repeat(c[:, None], w, axis=1) for c in cols], axis=2).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]; dist = np.sqrt((xx - 0.5 * w) ** 2 + (yy - 0.62 * h) ** 2); img += np.exp(-(dist / (0.18 * w)) ** 2)[..., None] * np.array((255, 210, 120)) * 0.9
    return np.clip(img, 0, 255).astype(np.uint8)
SKY = _make_sunset_sky()
def gtext_layer(size, items):
    """items: (texto, fonte, (cx, cy), cor0, cor1, contorno) -> RGBA com degradê vertical, sombra e contorno"""
    base_ = Image.new("RGBA", size, (0, 0, 0, 0))
    for (text, font, ctr, c0, c1, stroke) in items:
        d0 = ImageDraw.Draw(base_); bb = d0.textbbox(ctr, text, font=font, anchor="mm"); h_ = max(1, bb[3] - bb[1])
        sh = Image.new("RGBA", size, (0, 0, 0, 0)); ImageDraw.Draw(sh).text((ctr[0] + 5, ctr[1] + 8), text, font=font, fill=(30, 0, 40, 210), anchor="mm"); base_.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3)))
        if stroke:
            so = Image.new("RGBA", size, (0, 0, 0, 0)); ImageDraw.Draw(so).text(ctr, text, font=font, fill=(255, 255, 255, 255), anchor="mm", stroke_width=stroke, stroke_fill=(255, 255, 255, 255)); base_.alpha_composite(so)
        mask = Image.new("L", size, 0); ImageDraw.Draw(mask).text(ctr, text, font=font, fill=255, anchor="mm")
        g = np.zeros((size[1], size[0], 3), np.uint8); tt_ = np.clip((np.arange(size[1]) - bb[1]) / h_, 0, 1)[:, None]
        for c in range(3): g[..., c] = (c0[c] * (1 - tt_) + c1[c] * tt_).astype(np.uint8)
        layer = Image.fromarray(g).convert("RGBA"); layer.putalpha(mask); base_.alpha_composite(layer)
    return np.array(base_)
def _mont9(sz):
    f = ImageFont.truetype(BASE + "fontes/Montserrat.ttf", sz)
    try: f.set_variation_by_axes([900])
    except Exception: pass
    return f
def make_title():
    k = 2; im = Image.new("RGBA", (1080 * k, 260 * k), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((70 * k, 20 * k, 1010 * k, 150 * k), 30 * k, fill=(24, 8, 40, 255))      # sombra
    d.rounded_rectangle((70 * k, 4 * k, 1010 * k, 134 * k), 30 * k, fill=(255, 214, 40, 255))
    f = _mont9(56 * k); t = "VOCÊ JÁ PROJETOU ASSIM?"; w = d.textlength(t, font=f); d.text(((1080 * k - w) / 2, 34 * k), t, font=f, fill=(24, 8, 40, 255))
    d.rounded_rectangle((250 * k, 154 * k, 830 * k, 239 * k), 24 * k, fill=(255, 64, 140, 255), outline=(24, 8, 40, 255), width=4 * k)
    f2 = _mont9(48 * k); t2 = "JUNTO COM A GENTE"; w2 = d.textlength(t2, font=f2); d.text(((1080 * k - w2) / 2, 168 * k), t2, font=f2, fill=(255, 255, 255, 255))
    return np.array(im.resize((1080, 260), Image.LANCZOS))
TITLE_IMG = make_title()
MISSION_IMG = gtext_layer((1080, 620), [("MISSÃO", F(210), (540, 130), (255, 215, 90), (255, 150, 40), 0), ("CUMPRIDA", F(210), (540, 345), (255, 215, 90), (255, 150, 40), 0)])
_mi = Image.fromarray(MISSION_IMG); _md = ImageDraw.Draw(_mi); _f = M_ = None
def _mont(sz, w=800):
    f = ImageFont.truetype(BASE + "fontes/Montserrat.ttf", sz)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
_t = "PROJETO APROVADO COM O CLIENTE"; _ff = _mont(40, 800); _w = _md.textlength(_t, font=_ff); _md.text(((1080 - _w) / 2, 520), _t, font=_ff, fill=(255, 255, 255, 255)); MISSION_IMG = np.array(_mi)
def char_card():
    k = 2; w_, h_ = 846, 153; im = canvas(w_ * k, h_ * k); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((0, 0, w_ * k - 1, h_ * k - 1), 28 * k, fill=(30, 10, 54, 228), outline=(255, 64, 140, 255), width=4 * k)
    d.text((36 * k, 14 * k), NAME.upper(), font=F(68 * k), fill=WHITE + (255,)); d.line((38 * k, 98 * k, 320 * k, 98 * k), fill=(255, 64, 140, 255), width=4 * k)
    d.text((38 * k, 104 * k), CARGO.upper(), font=_mont(34 * k, 700), fill=(255, 170, 90, 255))
    lg = Image.fromarray(cv2.resize(LOGO_W, (230 * k, int(LOGO_W.shape[0] * 230 / LOGO_W.shape[1]) * k), interpolation=cv2.INTER_AREA)); im.alpha_composite(lg, ((w_ - 250) * k, ((h_ - lg.height // k) // 2) * k))
    return np.array(im.resize((w_, h_), Image.LANCZOS))
CARD_IMG = char_card()
TICKS = [t_esc + 0.9, t_prev + 0.9, t_ajus + 1.3]
for tt_ in TICKS: sfx(tt_, "d", -17)
def objective_hud(out, t):
    t0 = t_esc - 0.3; t1 = t_nao + 0.4
    if t < t0 or t > t1: return
    ein = ease((t - t0) / 0.35); eout = ease((t - (t1 - 0.3)) / 0.3); a = ein * (1 - eout); dx = int((1 - ein) * -640 - eout * 640)
    k = 2; w_, h_ = 1000, 300; im = canvas(w_ * k, h_ * k); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((0, 0, 600 * k, h_ * k - 1), 28 * k, fill=(30, 10, 54, 222), outline=(255, 255, 255, 80), width=3 * k)
    d.text((28 * k, 16 * k), "OBJETIVO", font=_mont(26 * k, 800), fill=(255, 170, 90, 255)); d.text((28 * k, 52 * k), "Projetar junto com o cliente", font=_mont(34 * k, 800), fill=WHITE + (255,))
    for i, (txt, tk) in enumerate((("Escutar a ideia", TICKS[0]), ("Apresentar a prévia", TICKS[1]), ("Ajustar cada detalhe", TICKS[2]))):
        y = 112 + i * 56; ok = t >= tk; p_ = back((t - tk) / 0.3) if ok else 0
        d.rounded_rectangle((28 * k, y * k, 70 * k, (y + 42) * k), 9 * k, outline=(255, 255, 255, 235), width=4 * k, fill=((255, 64, 140, 255) if ok else (0, 0, 0, 0)))
        if ok and p_ > 0.4: d.line([(38 * k, (y + 22) * k), (47 * k, (y + 32) * k), (62 * k, (y + 11) * k)], fill=WHITE + (255,), width=6 * k)
        d.text((88 * k, (y + 2) * k), txt, font=_mont(31 * k, 700), fill=WHITE + (255 if not ok else 180,))
    cx, cy, r = 800, 120, 100   # minimapa com a planta
    d.ellipse(((cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k), fill=(30, 10, 54, 222), outline=(255, 255, 255, 220), width=5 * k)
    for (x0, y0, x1, y1) in ((-62, -42, 62, -42), (62, -42, 62, 46), (62, 46, -62, 46), (-62, 46, -62, -42), (0, -42, 0, 6), (-62, 6, 62, 6)): d.line(((cx + x0) * k, (cy + y0) * k, (cx + x1) * k, (cy + y1) * k), fill=(255, 170, 90, 255), width=5 * k)
    pa = 0.5 + 0.5 * math.sin(t * 6); d.polygon([(cx * k, (cy + 24) * k), ((cx - 11) * k, (cy + 46) * k), ((cx + 11) * k, (cy + 46) * k)], fill=(255, 64, 140, int(160 + 95 * pa)))
    blend(out, np.array(im.resize((w_, h_), Image.LANCZOS)), 40 + dx, 250, a)
def overlays(out, t):
    if 0.15 <= t < 1.75:
        e = back((t - 0.15) / 0.4); ex = ease((t - 1.45) / 0.28) if t > 1.45 else 0.0
        blend(out, CARD_IMG, int(lerp(-1000, 117, min(1.2, e))) - int(ex * 1100), 262, min(1, (t - 0.15) / 0.1))
    if 1.6 <= t < HOOK_END + 0.35:
        exit_p = ease((t - HOOK_END) / 0.3) if t > HOOK_END else 0.0; fa = 1 - exit_p; p = back((t - 1.6) / 0.45); sc = max(0.3, min(1.05, 0.55 + 0.45 * p))
        im2 = cv2.resize(TITLE_IMG, (int(1080 * sc), int(260 * sc))); blend(out, im2, (W - im2.shape[1]) // 2, 262 + int((260 - im2.shape[0]) / 2) - int(exit_p * 70), fa * min(1, (t - 1.6) / 0.2))
    objective_hud(out, t)
    top_chip_anim(out, t, *E_chip); top_chip_anim(out, t, *E_chip2)
    for (t0_, d_, txt_, col_) in E_imp: impact(out, t, t0_, d_, txt_, col_, y=300)
    row_cards(out, E_who, 4, t)
'''
a = s.index("def overlays(out, t):"); b = s.index("# ================= SIMULAÇÃO DA CONVERSA COM O CLIENTE")
s = s[:a] + helpers_game + "\n\n" + s[b:]

# ---- habilidades desbloqueadas (disciplinas BIM) ----
rep("T_APPR = t_escl + 0.9\n", r'''T_APPR = t_escl + 0.9
_tt = np.linspace(P0, t_hero_ + 0.5, 800); _uu = np.array([u_of(x) for x in _tt])
def t_of_u(u_): return float(np.interp(u_, _uu, _tt))
SKILLS = [(nm_, col_, t_of_u(u_in_)) for (nm_, col_, u_in_) in cb.DISCIPLINES]
for (_, _, ts_) in SKILLS: sfx(ts_, "d", -16)
def skill_banner(out, t, dy):
    for (nm_, col_, ts_) in SKILLS:
        tl = t - ts_
        if tl < 0 or tl > 1.9: continue
        k = 2; w_, h_ = 470, 84; im = canvas(w_ * k, h_ * k); d = ImageDraw.Draw(im, "RGBA")
        d.rounded_rectangle((0, 0, w_ * k - 1, h_ * k - 1), 22 * k, fill=(30, 10, 54, 235), outline=(255, 64, 140, 255), width=3 * k)
        d.rectangle((0, 0, 12 * k, h_ * k), fill=col_ + (255,)); d.text((30 * k, 8 * k), "HABILIDADE DESBLOQUEADA", font=_mont(19 * k, 800), fill=(255, 170, 90, 255)); d.text((30 * k, 32 * k), nm_, font=F(40 * k), fill=WHITE + (255,))
        e = ease(tl / 0.3); ex = ease((tl - 1.6) / 0.3); a = e * (1 - ex)
        blend(out, np.array(im.resize((w_, h_), Image.LANCZOS)), int(560 + (1 - e) * 500 + ex * 500), 655 + dy, a)
''')
rep("        u = u_of(t)\n        # selo de compatibilização", "        u = u_of(t); skill_banner(out, t, dy)\n        # selo de compatibilização")

# ---- final: MISSÃO CUMPRIDA no lugar do painel ----
a = s.index('        d_ = canvas(900, 310); dd = ImageDraw.Draw(d_, "RGBA")'); b = s.index("        blend(out, np.array(d_), 90, 250 - int((1 - q) * 90), q)") + len("        blend(out, np.array(d_), 90, 250 - int((1 - q) * 90), q)")
s = s[:a] + "        pm = back((t - t_hero_) / 0.5); scm = max(0.3, min(1.1, 0.55 + 0.45 * pm)); im_m = cv2.resize(MISSION_IMG, (int(1080 * scm), int(620 * scm)))\n        blend(out, im_m, (W - im_m.shape[1]) // 2, 250 + int((620 - im_m.shape[0]) / 2), min(1, (t - t_hero_) / 0.25))" + s[b:]

# ---- cor aplicada em cada quadro de filmagem ----
rep("    rgbs = cv2.cvtColor(base, cv2.COLOR_BGR2RGB)\n    if kind == \"outro\":", "    rgbs = cv2.cvtColor(base, cv2.COLOR_BGR2RGB)\n    if kind == \"outro\":")
open(BASE + "montar_game.py", "w").write(s); print("gerado")
