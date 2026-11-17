"""Gera montar_reuniao.py (vídeo "projeto feito junto com o cliente") reaproveitando as peças do vídeo 1 e da obra."""
BASE = "BASE_AQUI/"
s = open(BASE + "montar_v21.py").read()
g = open(BASE + "gera_obra.py").read()
def between(a, b): return s[s.index(a):s.index(b)]
head = s[:s.index("SEGS = [(0.0")]
helpers = between("def clean(fr):", "# ================= linha do tempo dos efeitos")
rest = between("def at(rgb, img, x, y, a=1.0)", "# ================= composição de cada quadro")
trans = between("# ================= transições", "def vf_for(src, kind):")
ov = g[g.index("overlay_code = r'''") + len("overlay_code = r'''"):g.index("loop_code = r'''")]
ov = ov[:ov.rindex("'''")]
comp = ov[:ov.index("# ----- eventos a partir da fala -----")]   # ícones, cartões em linha, impacto, carimbo, chip, barra

new_head = r'''
# ================= PLANO DE CORTES (vídeo: projeto feito junto com o cliente) =================
V2 = BASE + "video2/"; ORI = V2 + "originais/"
TAKES = [dict(f="Rua_Sao_Jorge_2.m4a", j="voz2.json", win=(0.7, 17.9)), dict(f="Rua_Sao_Jorge_3.m4a", j="voz3.json", win=(0.9, 19.2))]
GAP_OUT = 0.18
kept = []; SEGS_AUD = []; out_t = 0.0
for ti, tk in enumerate(TAKES):
    ws = json.load(open(V2 + tk["j"])); sel = []
    for i, x in enumerate(ws):
        if tk["win"][0] <= x["s"] < tk["win"][1]: sel.append(dict(x, take=ti, idx=i))
    # correções de transcrição
    fixed = []; skip = False
    for k_, x in enumerate(sel):
        w_ = x["w"]
        if w_.lower().startswith("bravo"): x["w"] = "Braves"
        if w_.lower() == "de" and k_ > 0 and sel[k_ - 1]["w"] == "Braves": continue
        if w_.lower().startswith("dinheiria"): x["w"] = "Engenharia,"
        fixed.append(x)
    cur_ = []
    groups_w = []
    for x in fixed:
        if cur_ and x["s"] - cur_[-1]["e"] <= 0.25: cur_.append(x)
        else:
            if cur_: groups_w.append(cur_)
            cur_ = [x]
    if cur_: groups_w.append(cur_)
    for sg in groups_w:
        first, last = sg[0], sg[-1]
        prev_e = ws[first["idx"] - 1]["e"] if first["idx"] > 0 else 0.0
        next_s = ws[last["idx"] + 1]["s"] if last["idx"] + 1 < len(ws) else 1e9
        a = max(first["s"] - 0.06, prev_e + 0.01); b = min(last["e"] + 0.10, next_s - 0.01); dur = b - a
        for x in sg: x["os"] = out_t + (x["s"] - a); x["oe"] = out_t + (x["e"] - a); kept.append(x)
        SEGS_AUD.append(dict(take=ti, a=a, b=b, o0=out_t, dur=dur)); out_t += dur + GAP_OUT
T_END = SEGS_AUD[-1]["o0"] + SEGS_AUD[-1]["dur"] + 0.05
T_CMT = T_END + 0.35; T_OUT = T_END + 2.2; TOTAL = T_END + 4.4
words = [{"w": x["w"], "s": x["os"], "e": x["oe"]} for x in kept]
groups, cur = [], []
for i, x in enumerate(words):
    cur.append(x); gap = words[i + 1]["s"] - x["e"] if i + 1 < len(words) else 9
    if len(cur) == 3 or x["w"][-1] in ".,?!" or gap > 0.25: groups.append(cur); cur = []
if cur: groups.append(cur)
def norm(w): return w.lower().strip(".,?!")
def occ(text): return [x for x in words if norm(x["w"]) == text]
print("duração da fala:", round(T_END, 1), "s | total:", round(TOTAL, 1), "s | segmentos de áudio:", len(SEGS_AUD))
print("texto:", " ".join(x["w"] for x in words))
T_SHRINK, T_FLIP = 99, 99
'''

events_code = r'''
# ----- ícones novos deste vídeo -----
_kind_icon_base = kind_icon
def kind_icon(d, k, kind, cx, cy):
    def P(x, y): return (x * k, y * k)
    DK = DARK + (255,)
    if kind == "escuta":
        d.rounded_rectangle((*P(cx - 50, cy - 40), *P(cx + 50, cy + 18)), 18 * k, fill=CYAN + (255,), outline=DK, width=5 * k)
        d.polygon([P(cx - 22, cy + 16), P(cx - 36, cy + 42), P(cx - 2, cy + 16)], fill=CYAN + (255,), outline=DK)
        for i in range(3): d.ellipse((*P(cx - 30 + i * 28, cy - 18), *P(cx - 16 + i * 28, cy - 4)), fill=DK)
    elif kind == "previa":
        d.rounded_rectangle((*P(cx - 46, cy - 40), *P(cx + 46, cy + 36)), 8 * k, fill=(247, 244, 237, 255), outline=DK, width=5 * k)
        for (xa, ya, xb, yb) in ((-34, -26, 34, -26), (34, -26, 34, 24), (34, 24, -34, 24), (-34, 24, -34, -26), (0, -26, 0, 4), (-34, 4, 20, 4)):
            d.line([P(cx + xa, cy + ya), P(cx + xb, cy + yb)], fill=DK, width=4 * k)
        d.ellipse((*P(cx + 20, cy - 52), *P(cx + 50, cy - 22)), fill=YEL + (255,), outline=DK, width=3 * k)
    elif kind == "ajuste":
        for i, (yy, kx) in enumerate(((-26, -14), (0, 18), (26, -6))):
            d.line([P(cx - 46, cy + yy), P(cx + 46, cy + yy)], fill=DK, width=7 * k); d.ellipse((*P(cx + kx - 11, cy + yy - 11), *P(cx + kx + 11, cy + yy + 11)), fill=YEL + (255,), outline=DK, width=4 * k)
    elif kind == "juntos":
        for dx, col in ((-22, CYAN), (22, YEL)):
            d.ellipse((*P(cx + dx - 18, cy - 44), *P(cx + dx + 18, cy - 8)), fill=col + (255,), outline=DK, width=4 * k)
            d.pieslice((*P(cx + dx - 34, cy - 4), *P(cx + dx + 34, cy + 60)), 180, 360, fill=col + (255,), outline=DK, width=4 * k)
    elif kind == "dono":
        d.ellipse((*P(cx - 22, cy - 22), *P(cx + 22, cy + 22)), fill=CYAN + (255,), outline=DK, width=4 * k)
        d.pieslice((*P(cx - 42, cy + 24), *P(cx + 42, cy + 96)), 180, 360, fill=CYAN + (255,), outline=DK, width=4 * k)
        d.polygon([P(cx + 18, cy - 38), P(cx + 56, cy - 38), P(cx + 37, cy - 56)], fill=(205, 100, 62, 255), outline=DK)
        d.rectangle((*P(cx + 24, cy - 38), *P(cx + 50, cy - 18)), fill=(246, 244, 240, 255), outline=DK, width=3 * k)
    elif kind == "obra":
        d.pieslice((*P(cx - 46, cy - 46), *P(cx + 46, cy + 40)), 180, 360, fill=YEL + (255,), outline=DK, width=5 * k)
        d.rounded_rectangle((*P(cx - 58, cy - 4), *P(cx + 58, cy + 14)), 8 * k, fill=YEL + (255,), outline=DK, width=5 * k)
        d.rectangle((*P(cx - 8, cy - 44), *P(cx + 8, cy - 6)), fill=(255, 230, 130, 255))
    elif kind == "viavel":
        d.rounded_rectangle((*P(cx - 52, cy - 14), *P(cx + 52, cy + 22)), 6 * k, fill=(240, 220, 150, 255), outline=DK, width=5 * k)
        for i in range(7): d.line([P(cx - 42 + i * 14, cy - 14), P(cx - 42 + i * 14, cy + (2 if i % 2 else 8))], fill=DK, width=3 * k)
        d.ellipse((*P(cx - 22, cy - 56), *P(cx + 22, cy - 12)), fill=(40, 200, 120, 255), outline=DK, width=4 * k)
        d.line([P(cx - 10, cy - 34), P(cx - 2, cy - 24), P(cx + 12, cy - 44)], fill=WHITE + (255,), width=6 * k)
    elif kind == "claro":
        d.ellipse((*P(cx - 56, cy - 34), *P(cx + 56, cy + 34)), fill=WHITE + (255,), outline=DK, width=6 * k)
        d.ellipse((*P(cx - 24, cy - 24), *P(cx + 24, cy + 24)), fill=CYAN + (255,)); d.ellipse((*P(cx - 10, cy - 10), *P(cx + 10, cy + 10)), fill=DK)
        d.ellipse((*P(cx + 4, cy - 18), *P(cx + 14, cy - 8)), fill=WHITE + (255,))
    else: _kind_icon_base(d, k, kind, cx, cy)
CARD_CACHE.clear()

# ----- eventos a partir da fala -----
def W_(text, n=0): return occ(text)[n]
EV = []
def sfx(t, f, db): EV.append((t, f, db))
t_esc = W_("escuta")["s"]; t_prev = W_("prévia")["s"]; t_ajus = W_("ajusta")["s"]; t_nao = W_("não")["s"]; t_proj = W_("projetamos")["s"]
t_para = W_("para")["s"]; t_agr = W_("agrade")["s"]; t_fac = W_("facilite")["s"]; t_isso = W_("isso")["s"]
HOOK_END = min(4.4, t_esc - 0.2)
E_step = [("escuta", "ESCUTA", t_esc - 0.05, t_nao + 0.3, False), ("previa", "PRÉVIA", t_prev - 0.05, t_nao + 0.3, False), ("ajuste", "AJUSTES", t_ajus - 0.05, t_nao + 0.3, False)]
t_todos = occ("todos")[0]["e"] + 0.9
E_who = [("dono", "PROPRIETÁRIO", W_("proprietário")["s"] - 0.05, t_todos, False), ("obra", "MÃO DE OBRA", W_("mão")["s"] - 0.05, t_todos, False),
         ("viavel", "VIÁVEL", W_("viável")["s"] - 0.05, t_todos, False), ("claro", "ESCLARECIDO", W_("esclarecido")["s"] - 0.05, t_todos, False)]
E_imp = [(W_("juntos", 0)["s"] - 0.05, 1.0, "JUNTOS", CYAN)]
E_chip = (W_("resultado")["s"] - 0.1, 2.4, "RESULTADO FINAL")
E_chip2 = (W_("ouvir")["s"] - 0.1, 2.0, "OUVIR O CLIENTE")
for it in E_step + E_who: sfx(it[2], "p", -17)
sfx(E_imp[0][0], "i", -11); sfx(E_chip[0], "w", -19); sfx(E_chip2[0], "w", -19)

# ================= vídeo: clipes e cortes =================
CLIPS = {c: ORI + f"IMG_{c}.MOV" for c in ("1053", "1054", "1055", "1075", "1076", "1080", "1084", "1085", "1089", "1090", "1091", "1092", "1109")}
CLIPDUR = {"1053": 5.9, "1054": 9.7, "1055": 6.1, "1075": 8.1, "1076": 7.6, "1080": 10.5, "1084": 4.8, "1085": 10.2, "1089": 15.4, "1090": 23.4, "1091": 11.4, "1092": 8.1, "1109": 15.5}
PLAN_SHOTS = [(0.0, t_esc - 0.15, "1054", 0.3), (t_esc - 0.15, t_prev - 0.1, "1054", 5.5), (t_prev - 0.1, t_ajus - 0.1, "1055", 0.4),
              (t_ajus - 0.1, t_nao - 0.1, "1092", 0.5), (t_nao - 0.1, t_proj - 0.1, "1091", 3.0), (t_proj - 0.1, t_para - 0.1, "1109", 12.5),
              (t_para - 0.1, t_agr - 0.1, "1089", 10.5), (t_agr - 0.1, t_fac - 0.1, "1090", 2.0), (t_fac - 0.1, t_isso - 0.1, "1090", 10.0),
              (t_isso - 0.1, T_END + 0.1, "1090", 18.0)]
# trechos onde a mulher aparece foram EXCLUÍDOS: 1053, 1075, 1084, 1085, 1089 (antes dos 10 s), 1076, 1080, 1092 (depois de 5,5 s), 1109 (antes dos 12 s)
# limites seguros de cada clipe (início, fim)
SAFE = {"1054": (0.0, 9.7), "1055": (0.0, 6.1), "1092": (0.0, 5.5), "1091": (3.0, 11.4), "1109": (12.0, 15.5), "1089": (10.0, 15.4), "1090": (0.0, 22.5)}
TRANS = {}
for k_, (a_, b_, c_, ss_) in enumerate(PLAN_SHOTS):
    lo_, hi_ = SAFE[c_]
    if ss_ < lo_ or ss_ + (b_ - a_) + 0.3 > hi_: print("AVISO: trecho fora da faixa segura", c_, "início", ss_, "dur", round(b_ - a_, 1), "faixa", SAFE[c_])
for k_, kind_ in ((2, "lens"), (4, "bricks"), (6, "section")): TRANS[round(PLAN_SHOTS[k_][0], 2)] = (kind_, 0.55)
TRANS[round(T_END + 0.1, 2)] = ("lens", 0.7)
for t_, (kd, d_) in TRANS.items(): sfx(t_, "w", -17)
sfx(0.05, "w", -16); sfx(0.15, "w", -19); sfx(1.62, "i", -14); sfx(T_CMT + 0.65, "d", -17); sfx(T_OUT + 0.1, "i", -11); sfx(T_OUT + 0.8, "d", -15)

def overlays(out, t):
    if 0.15 <= t < 1.75:
        e = back((t - 0.15) / 0.4); ex = ease((t - 1.45) / 0.28) if t > 1.45 else 0.0
        blend(out, PLATE_ID, int(lerp(-1000, 117, min(1.2, e))) - int(ex * 1100), 262, min(1, (t - 0.15) / 0.1))
    if 1.6 <= t < HOOK_END + 0.35:
        exit_p = ease((t - HOOK_END) / 0.3) if t > HOOK_END else 0.0; fa = 1 - exit_p
        for (txt, bgc, y, t0_, frm, rot) in (("PROJETO FEITO COM O CLIENTE", WHITE, 290, 1.6, -W, 2.0), ("VEJA COMO FUNCIONA", CYAN, 390, 1.78, W, -2.0)):
            p = (t - t0_) / 0.35
            if p < 0: continue
            e = back(p); dx = int(frm * (1 - min(1.0, e))) if p < 1.3 else 0
            im = hook_bar(txt, bgc, DARK, rot=rot); blend(out, im, (W - im.shape[1]) // 2 + dx, y - int(exit_p * 60), fa)
    row_cards(out, E_step, 3, t, y=262)
    top_chip_anim(out, t, *E_chip); top_chip_anim(out, t, *E_chip2)
    for (t0_, d_, txt_, col_) in E_imp: impact(out, t, t0_, d_, txt_, col_, y=300)
    row_cards(out, E_who, 4, t)


# ================= SIMULAÇÃO DA CONVERSA COM O CLIENTE (BIM multidisciplinar) =================
HERO_SRC_REPLACE = True
_sp2 = importlib.util.spec_from_file_location("casa_bim", BASE + "casa_bim.py"); cb = importlib.util.module_from_spec(_sp2); _sp2.loader.exec_module(cb)
MODEL = "B"
SIM_A0 = t_para - 0.1
P0 = SIM_A0 + 0.9
t_viavel = W_("viável")["s"]; t_escl = W_("esclarecido")["s"]; t_hero_ = W_("isso")["s"] - 0.15
def u_of(t): return float(np.interp(t, [P0, t_agr, t_fac, t_viavel, t_escl, t_hero_ + 0.5], [0.0, 4.4, 6.4, 8.0, 9.8, 11.6]))
MSGS = [("c", "Quero a cozinha integrada à sala", SIM_A0 + 0.45), ("b", "Já ajusto no modelo BIM", SIM_A0 + 1.9), ("c", "E a parte de água e esgoto?", t_agr + 0.15),
        ("b", "Hidrossanitário já no modelo", t_agr + 1.2), ("b", "Elétrica sem conflito com a viga", t_viavel + 0.9), ("c", "Tudo certo para executar!", t_escl + 0.25)]
T_APPR = t_escl + 0.9
for (_, _, tm) in MSGS: sfx(tm + 0.5, "p", -17)
sfx(T_APPR, "i", -11); sfx(t_hero_, "w", -18); sfx(P0 + (cb.TL["explode"] and 0) + 2.9, "w", -19)
def avatar_np(img, box, size=66):
    a = Image.fromarray(img).crop(box).resize((size, size), Image.LANCZOS); m_ = Image.new("L", (size, size), 0); ImageDraw.Draw(m_).ellipse((0, 0, size - 1, size - 1), fill=255)
    bgc = Image.new("RGBA", (size, size), CYAN + (255,)); bgc.alpha_composite(a); bgc.putalpha(m_); return bgc
def chat_panel(t):
    k = 2; Wp, Hp = 900, 310; im = canvas(Wp * k, Hp * k); d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle((0, 0, Wp * k - 1, Hp * k - 1), 36 * k, fill=(9, 22, 52, 238), outline=CYAN + (255,), width=4 * k)
    crew = t >= t_fac
    av = avatar_np(WORKER if crew else CLIENT, (50, 14, 250, 214)); im.alpha_composite(av.resize((66 * k, 66 * k)), (26 * k, 16 * k))
    d.text((106 * k, 18 * k), "Equipe de obra" if crew else "Cliente", font=mont(34 * k, 800), fill=WHITE + (255,))
    d.ellipse((108 * k, 66 * k, 124 * k, 82 * k), fill=(40, 200, 120, 255)); d.text((132 * k, 60 * k), "online", font=mont(24 * k, 600), fill=(170, 185, 210, 255))
    vis = [m_ for m_ in MSGS if t >= m_[2]][-3:]; y = 294
    f = mont(32 * k, 700)
    for who, text, tin in reversed(vis):
        tl = t - tin; bh = 62; typing = tl < 0.5
        w_ = 120 if typing else int(d.textlength(text, font=f) / k) + 52
        y -= bh; x = 26 if who == "c" else 900 - 26 - w_
        col = (245, 247, 252, 255) if who == "c" else CYAN + (255,)
        d.rounded_rectangle((x * k, y * k, (x + w_) * k, (y + bh) * k), 28 * k, fill=col)
        if typing:
            for i in range(3):
                bob = abs(math.sin(t * 8 + i * 0.8)) * 7
                d.ellipse(((x + 34 + i * 26) * k, (y + 26 - bob) * k, (x + 48 + i * 26) * k, (y + 40 - bob) * k), fill=(90, 100, 120, 255))
        else: d.text(((x + 26) * k, (y + 12) * k), text, font=f, fill=DARK + (255,))
        y -= 10
    return np.array(im.resize((Wp, Hp), Image.LANCZOS))
def disc_chips(u):
    k = 2; Wp = 880; im = canvas(Wp * k, 44 * k); d = ImageDraw.Draw(im, "RGBA"); f = mont(21 * k, 800); x = 6
    for (name, col, u_in) in cb.DISCIPLINES:
        if u < u_in: continue
        p = back((u - u_in) / 0.3); w_ = int(d.textlength(name, font=f) / k) + 52
        sc = max(0.05, p)
        d.rounded_rectangle((x * k, 2 * k, (x + w_ * sc) * k, 42 * k), 20 * k, fill=(255, 255, 255, 235))
        d.ellipse(((x + 12) * k, 13 * k, (x + 32) * k, 33 * k), fill=col + (255,), outline=DARK + (255,), width=2 * k)
        if sc > 0.9: d.text(((x + 40) * k, 9 * k), name, font=f, fill=DARK + (255,))
        x += w_ + 10
    return np.array(im.resize((Wp, 44), Image.LANCZOS))
def project_panel(t):
    k = 2; Wp, Hp = 900, 585; base_ = canvas(Wp * k, Hp * k); d = ImageDraw.Draw(base_, "RGBA")
    d.rounded_rectangle((0, 0, Wp * k - 1, Hp * k - 1), 36 * k, fill=(9, 22, 52, 238), outline=CYAN + (255,), width=4 * k)
    pan = np.array(base_.resize((Wp, Hp), Image.LANCZOS)); u = u_of(t)
    if t >= P0:
        ils = np.ascontiguousarray(cb.render(u, MODEL)[60:640, 110:890])
        ox, oy = (Wp - ils.shape[1]) // 2, 4
        rgb_ = pan[..., :3].astype(np.float32); reg = rgb_[oy:oy + ils.shape[0], ox:ox + ils.shape[1]]; al = ils[..., 3:4].astype(np.float32) / 255
        reg[:] = reg * (1 - al) + ils[..., :3] * al; pan[..., :3] = rgb_.astype(np.uint8)
        blend(pan, disc_chips(u), 10, 8, 1.0) if False else None
        ch = disc_chips(u); r2 = pan[..., :3].astype(np.float32); a2 = ch[..., 3:4].astype(np.float32) / 255; r2[8:8 + 44, 10:10 + ch.shape[1]] = r2[8:8 + 44, 10:10 + ch.shape[1]] * (1 - a2) + ch[..., :3] * a2; pan[..., :3] = r2.astype(np.uint8)
    return pan
def sim_scene(out, t, rgbs):
    bgf = cv2.GaussianBlur(rgbs, (0, 0), 24).astype(np.float32); navy = np.array((9, 22, 52), np.float32)
    out[:] = np.clip(bgf * 0.38 + navy * 0.42, 0, 255).astype(np.uint8)
    e = ease((t - SIM_A0) / 0.45); dy = int((1 - e) * 90)
    if t < t_hero_:
        blend(out, chat_panel(t), 90, 250 - dy, e)
        blend(out, project_panel(t), 90, 585 + dy, e)
        u = u_of(t)
        # selo de compatibilização
        if cb.TL["clash"] <= u < cb.TL["resolve"] + 1.0:
            res = u >= cb.TL["resolve"]; q = back((u - (cb.TL["resolve"] if res else cb.TL["clash"])) / 0.3)
            chip = top_chip("COMPATIBILIZADO: SEM CONFLITO" if res else "CONFLITO: ELÉTRICA x VIGA", (40, 200, 120) if res else (235, 40, 40), WHITE, 0.8); at(out, chip, 120, 1100 + dy, min(1, q) * e)
        if t >= T_APPR:
            q = (t - T_APPR) / 0.25; sc = 1.5 - 0.5 * ease(q) if q < 1 else 1.0
            fade = 1 - ease((t - (T_APPR + 1.4)) / 0.3) if t > T_APPR + 1.4 else 1.0
            if fade > 0.01: im = stamp_txt("APROVADO", round(sc, 2)); at(out, im, (W - im.shape[1]) // 2 + 100, 760, min(1, q * 2) * fade)
            chip = top_chip("APROVADO", (40, 200, 120), WHITE, 0.85); at(out, chip, 700, 1100 + dy, min(1, (t - T_APPR) / 0.3) * (1 - fade) * e)
        if t >= t_fac:
            q = back((t - t_fac) / 0.4); w_ = WORKER; sc_ = max(0.05, q) * 0.62
            im2 = cv2.resize(w_, (int(w_.shape[1] * sc_), int(w_.shape[0] * sc_))); at(out, im2, 850 - int(im2.shape[1] / 2), 1165 - im2.shape[0], min(1, (t - t_fac) / 0.2))
    else:
        q = ease((t - t_hero_) / 0.4); hero = hero_b((t - t_hero_), t)
        hw, hh = 880, int(500 * 880 / 760); hs = cv2.resize(hero, (hw, hh)); mk = cv2.resize(HMASK, (hw, hh))
        blend(out, np.dstack([hs, mk]), (W - hw) // 2, 585 + int((1 - q) * 90), q)
        ey = eye_img(ease((t - t_hero_) / 0.3), t); sm = cv2.resize(ey, (int(ey.shape[1] * 0.6), int(ey.shape[0] * 0.6))); at(out, sm, 770, 600 + int((1 - q) * 90), q)
        d_ = canvas(900, 310); dd = ImageDraw.Draw(d_, "RGBA"); dd.rounded_rectangle((0, 0, 899, 309), 36, fill=(9, 22, 52, 238), outline=CYAN + (255,), width=4)
        f = F(78); txt = "PROJETANDO COM O CLIENTE"; w_ = dd.textlength(txt, font=f); dd.text(((900 - w_) / 2, 28), txt, font=f, fill=WHITE + (255,), stroke_width=4, stroke_fill=(0, 0, 0, 255))
        for i, c_ in enumerate((CYAN, WHITE, YEL)):
            pi = PEOPLE[c_]; p_ = back((t - t_hero_ - 0.2 - i * 0.12) / 0.3)
            if p_ > 0:
                s_ = max(0.05, p_); im3 = Image.fromarray(cv2.resize(pi, (int(pi.shape[1] * s_ * 0.9), int(pi.shape[0] * s_ * 0.9)))); d_.alpha_composite(im3, (260 + i * 150 - im3.width // 2 + 70, 250 - im3.height))
        blend(out, np.array(d_), 90, 250 - int((1 - q) * 90), q)

# ================= composição =================
def compose(t, base, kind, si, frac):
    rgbs = cv2.cvtColor(base, cv2.COLOR_BGR2RGB)
    if kind == "outro":
        out = stage_bg(t); put_scaled(out, rgbs, SC, (230, 634), CARD, 36, border=6)
        if t >= T_OUT:
            e = ease((t - T_OUT) / 0.35); bg2 = stage_bg(t); out[880:1580] = (out[880:1580] * (1 - e) + bg2[880:1580] * e).astype(np.uint8)
        scene_s6_extras(out, t); outro(out, t); return out
    z = (1.0 if si % 2 == 0 else 1.06) + 0.03 * frac
    out = zoom_(rgbs.copy(), z, 540, 900)
    if t < 0.35:
        k = int(1 + 10 * (1 - t / 0.35)) | 1; out = cv2.GaussianBlur(out, (k, k), 0)
    if SIM_A0 <= t < T_END + 0.1:
        sim_scene(out, t, rgbs); row_cards(out, E_who, 4, t); draw_caption(out, t, 1395); return out
    overlays(out, t); draw_caption(out, t, 1395)
    return out
'''

loop_code = r'''
HDRV = HDRC
def vf_clip(): return f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},fps={FPS},{HDRV}"
# ================= loop principal =================
OUTNAME = V2 + "reuniao_semaudio.mp4"
wr = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                       "-i", "-", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", OUTNAME], stdin=subprocess.PIPE)
fsz = W * H * 3; n_out = 0; hold = None
shots = [dict(t0=a_, t1=b_, clip=c_, ss=ss_, kind="f", si=i) for i, (a_, b_, c_, ss_) in enumerate(PLAN_SHOTS)]
shots.append(dict(t0=T_END + 0.1, t1=TOTAL, clip="1055", ss=max(0, CLIPDUR["1055"] - (TOTAL - T_END) - 0.2), kind="outro", si=len(shots)))
for sh in shots:
    t0, t1 = sh["t0"], sh["t1"]; nfr = int(round((t1 - t0) * FPS))
    rd = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-ss", str(sh["ss"]), "-t", str(t1 - t0 + 0.3), "-i", CLIPS[sh["clip"]], "-vf", vf_clip(), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    last = None
    for k in range(nfr):
        buf = rd.stdout.read(fsz)
        if len(buf) == fsz: last = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        if last is None: last = np.zeros((H, W, 3), np.uint8)
        t = n_out / FPS
        rgb = compose(t, last.copy(), sh["kind"], sh["si"], k / max(1, nfr - 1))
        tr = TRANS.get(round(t0, 2))
        if tr and hold is not None and t - t0 < tr[1]: rgb = transition(tr[0], hold, rgb, (t - t0) / tr[1])
        wr.stdin.write(rgb.tobytes()); n_out += 1
        if k == nfr - 1: hold = compose(t1 - 1 / FPS, last.copy(), sh["kind"], sh["si"], 1.0)
    rd.stdout.close(); rd.wait()
wr.stdin.close(); wr.wait()
print("quadros", n_out, n_out / FPS)
json.dump({"total": TOTAL, "t_end": T_END, "segs": SEGS_AUD, "sfx": EV}, open(V2 + "tempos_reuniao.json", "w"))
'''
hero_b = open(BASE + "hero_b_src.py").read()
open(BASE + "montar_reuniao.py", "w").write(head + new_head + "\n" + helpers + "\n" + rest + "\n" + trans + "\n" + comp + "\n" + hero_b + "\n" + events_code + "\n" + loop_code)
print("gerado")
