import subprocess, math, importlib.util
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
BASE="/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"; V2=BASE+"video2/"
exec(open(BASE+"previa_game.py").read().split("# ---------- quadro 1")[0])

import random
def caricatura(img):
    """Foto -> arte de capa de jogo mantendo o rosto reconhecível: pintura suave, contorno fino, cor viva."""
    sm = img.copy()
    for _ in range(2): sm = cv2.bilateralFilter(sm, 11, 40, 9)                 # pele lisa, bordas preservadas
    sm = cv2.detailEnhance(sm, sigma_s=12, sigma_r=0.18)                        # volume e definição
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY); g = cv2.GaussianBlur(g, (0, 0), 1.6)
    ed = cv2.Canny(g, 40, 110); ed = cv2.dilate(ed, np.ones((2, 2), np.uint8)); ed = cv2.GaussianBlur(ed, (0, 0), 0.9).astype(np.float32) / 255.0
    out = sm.astype(np.float32) * (1 - 0.55 * ed[..., None])                    # contorno fino tipo HQ
    lab = cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32); L = lab[..., 0]
    lab[..., 0] = 0.7 * L + 0.3 * (np.round(L / 20.0) * 20.0)                    # leve sombreado em degraus
    out = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    hsv = cv2.cvtColor(out, cv2.COLOR_RGB2HSV).astype(np.float32); hsv[..., 1] = np.clip(hsv[..., 1] * 1.12, 0, 255); hsv[..., 2] = np.clip(hsv[..., 2] * 1.05 + 4, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    # luz de pôr do sol só nas bordas (rim light quente), sem tingir a pele
    yy, xx = np.mgrid[0:out.shape[0], 0:out.shape[1]]; rim = np.clip((xx / out.shape[1] - 0.55) * 1.6, 0, 1)[..., None] * np.array([40, 18, 0], np.float32)
    return np.clip(out.astype(np.float32) + rim, 0, 255).astype(np.uint8)
bg=caricatura(np.clip(frame("IMG_1054.MOV",2.2),0,255).astype(np.uint8))
# ---- céu de pôr do sol estilo "cidade neon" ----
sky=np.zeros((H,W,3),np.float32)
stops=[(0,(40,10,90)),(0.28,(150,30,140)),(0.5,(255,90,120)),(0.68,(255,170,70)),(1.0,(255,210,110))]
for y in range(H):
    p=y/(H-1)
    for (a,ca),(b,cb_) in zip(stops,stops[1:]):
        if a<=p<=b:
            t=(p-a)/(b-a); sky[y]=[ca[i]*(1-t)+cb_[i]*t for i in range(3)]; break
img=Image.fromarray(sky.astype(np.uint8)).convert("RGBA"); d=ImageDraw.Draw(img,"RGBA")
# sol (aparece atrás do título) + horizonte + chão escuro
sx,sy,sr=540,690,300
glow=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow); gd.ellipse((sx-sr-90,sy-sr-90,sx+sr+90,sy+sr+90),fill=(255,150,60,110)); glow=glow.filter(ImageFilter.GaussianBlur(60)); img.alpha_composite(glow)
sun=Image.new("RGBA",(W,H),(0,0,0,0)); sd=ImageDraw.Draw(sun)
for i in range(sr*2):
    t=i/(sr*2); c=(255,int(225-120*t),int(120+30*t),255); yy=sy-sr+i; hw=int(math.sqrt(max(0,sr*sr-(yy-sy)**2)))
    sd.line((sx-hw,yy,sx+hw,yy),fill=c)
img.alpha_composite(sun)
d.rectangle((0,1560,W,H),fill=(28,8,46,255))
for yy in range(1560,H,26): d.line((0,yy,W,yy),fill=(255,64,140,60),width=2)
# cidade
for i in range(26):
    x=i*44-10; hgt=random.Random(i).randint(90,300); d.rectangle((x,1560-hgt,x+38,1560),fill=(44,12,66,255))
    for r_ in range(0,hgt-20,34):
        if random.Random(i*50+r_).random()<0.35: d.rectangle((x+8,1560-hgt+14+r_,x+14,1560-hgt+24+r_),fill=(255,190,90,200))
# palmeiras
def frond(top,ang,L,curve,w0,sc):
    a_=math.radians(ang); pts_l=[];pts_r=[]
    for i in range(0,25):
        t=i/24; x=top[0]+math.cos(a_)*L*t; y=top[1]+math.sin(a_)*L*t+curve*L*t*t
        w=w0*(1-t)**0.8*sc; pts_l.append((x,y-w)); pts_r.append((x,y+w))
    d.polygon(pts_l+pts_r[::-1],fill=(22,5,38,255))
def palm(x,base,h,lean,sc=1.0):
    pts=[(x+lean*(i/30)**2, base-h*i/30) for i in range(31)]; top=pts[-1]
    d.polygon([(px-12*sc*(1-i/45),py) for i,(px,py) in enumerate(pts)]+[(px+12*sc*(1-i/45),py) for i,(px,py) in list(enumerate(pts))[::-1]],fill=(22,5,38,255))
    for ang,L,cv in ((-170,330,0.55),(-140,360,0.5),(-110,300,0.4),(-75,300,0.4),(-45,360,0.5),(-12,330,0.55),(15,260,0.6),(165,260,0.6)):
        frond(top,ang,L*sc,cv,16,sc)
palm(60,1580,880,60); palm(1020,1580,760,-70,0.9)
# foto natural em painel inclinado (estilo capa de jogo)
ph=Image.fromarray(bg).convert("RGBA"); pw,pH=800,880; ph=ph.crop((int((W-pw*0.9)/2),260,int((W+pw*0.9)/2),260+int(pH*0.9))).resize((pw,pH),Image.LANCZOS)
m=Image.new("L",(pw,pH),0); ImageDraw.Draw(m).rounded_rectangle((0,0,pw-1,pH-1),34,fill=255); ph.putalpha(m)
fr=Image.new("RGBA",(pw+24,pH+24),(0,0,0,0)); fd=ImageDraw.Draw(fr); fd.rounded_rectangle((0,0,pw+23,pH+23),42,fill=(255,255,255,255)); fr.alpha_composite(ph,(12,12))
fr=fr.rotate(3.5,resample=Image.BICUBIC,expand=True)
sh=Image.new("RGBA",fr.size,(0,0,0,0)); sh.putalpha(fr.getchannel("A").point(lambda v:int(v*0.55))); sh=sh.filter(ImageFilter.GaussianBlur(26))
img.alpha_composite(sh,((W-fr.width)//2+16,700+30)); img.alpha_composite(fr,((W-fr.width)//2,700))
# logo no topo
logo=Image.open(BASE+"logos/word_white.png").convert("RGBA"); lw=470; lh=int(logo.height*lw/logo.width); logo=logo.resize((lw,lh),Image.LANCZOS)
gl=np.array(logo); gl[...,0],gl[...,1],gl[...,2]=(255,64,140); gl=Image.fromarray(gl).filter(ImageFilter.GaussianBlur(14))
img.alpha_composite(gl,((W-lw)//2,50)); img.alpha_composite(logo,((W-lw)//2,50))
# título grande com degradê e contorno
_im=Image.fromarray(np.array(img.convert("RGB"))).convert("RGBA"); _d=ImageDraw.Draw(_im,"RGBA")
_lines=("VOCÊ JÁ","PROJETOU ASSIM?"); _fs=150
while M(_fs,900).getlength(_lines[1])>860: _fs-=4
_f=M(_fs,900)
_d.rounded_rectangle((60,324,1020,604),44,fill=(24,8,40,255))
_d.rounded_rectangle((60,304,1020,584),44,fill=(255,214,40,255))
for _t,_y in zip(_lines,(318,438)):
    _w=_d.textlength(_t,font=_f); _d.text(((W-_w)/2,_y-6),_t,font=_f,fill=(24,8,40,255))
_d.rounded_rectangle((150,566,930,656),30,fill=(255,64,140,255),outline=(24,8,40,255),width=5)
_f=M(56,900); _t="JUNTO COM A GENTE"; _w=_d.textlength(_t,font=_f); _d.text(((W-_w)/2,580),_t,font=_f,fill=(255,255,255,255))
arr=np.array(_im.convert("RGB"))
img=Image.fromarray(arr).convert("RGBA"); d=ImageDraw.Draw(img,"RGBA")
# faixa inferior
band=Image.new("RGBA",(920,120),(0,0,0,0)); bd=ImageDraw.Draw(band); bd.rounded_rectangle((0,0,919,119),30,fill=(30,10,54,235),outline=(255,255,255,200),width=4)
txt="PROJETAR JUNTO COM O CLIENTE"; f=F(58); w_=bd.textlength(txt,font=f); bd.text(((920-w_)/2,28),txt,font=f,fill=(255,255,255,255))
img.alpha_composite(band,(80,1665))
d=ImageDraw.Draw(img,"RGBA"); t2="ROGÉRIO OTÁVIO  |  ENGENHEIRO CIVIL"; ff=M(32,800); w2=d.textlength(t2,font=ff); d.text(((W-w2)/2,1818),t2,font=ff,fill=(255,255,255,240),stroke_width=2,stroke_fill=(40,10,60,255))
img.convert("RGB").save(V2+"capa_game.png"); print("capa game ok")
