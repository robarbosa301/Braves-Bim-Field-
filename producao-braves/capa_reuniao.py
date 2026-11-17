import math, random, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
BASE="/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"; V=BASE+"video1/"
W,H=1080,1920
YEL,WHITE,CYAN,RED,DARK=(255,196,0),(255,255,255),(0,229,255),(225,6,0),(20,20,24)
def F(s): return ImageFont.truetype(BASE+"fontes/Anton-Regular.ttf",s)
def canvas(w,h): return Image.new("RGBA",(w,h),(0,0,0,0))
def tw(d,t,f,sw=0):
    b=d.textbbox((0,0),t,font=f,stroke_width=sw); return b[2]-b[0],b[3]-b[1]
# ícones do vídeo (mesmo código)
src=open(BASE+"gera_obra.py").read(); a=src.index("def kind_icon(d, k, kind, cx, cy):"); b=src.index("CARD_CACHE = {}")
exec(src[a:b])
g2=open(BASE+"gera_reuniao.py").read(); a2=g2.index("_kind_icon_base = kind_icon"); b2=g2.index("CARD_CACHE.clear()"); exec(g2[a2:b2])
# fundo
bg=np.zeros((H,W,3),np.float32)
for c,(x,y) in enumerate(zip((16,40,92),(5,12,34))): bg[...,c]=np.linspace(x,y,H)[:,None]
yy,xx=np.mgrid[0:H,0:W]; bg+=np.exp(-(((xx-540)/620.0)**2+((yy-1250)/520.0)**2))[...,None]*np.array((0,40,70))
for i in range(0,W,60): bg[:,i]=bg[:,i]*0.88+np.array(CYAN)*0.12
for j in range(0,H,60): bg[j,:]=bg[j,:]*0.88+np.array(CYAN)*0.12
for i in range(0,W,240): bg[:,i]=bg[:,i]*0.78+np.array(CYAN)*0.22
for j in range(0,H,240): bg[j,:]=bg[j,:]*0.78+np.array(CYAN)*0.22
bg*=np.clip(1-0.45*(((xx-540)/700.0)**2+((yy-960)/1100.0)**2),0.4,1)[...,None]
img=Image.fromarray(np.clip(bg,0,255).astype(np.uint8)).convert("RGBA"); rng=random.Random(5); d=ImageDraw.Draw(img,"RGBA")
for _ in range(34):
    x,y=rng.randint(40,1040),rng.randint(60,1860); al=rng.randint(70,150); d.line((x-9,y,x+9,y),fill=CYAN+(al,),width=3); d.line((x,y-9,x,y+9),fill=CYAN+(al,),width=3)
def shadow(w,h,r,blur=22,alpha=170,off=18):
    s=Image.new("RGBA",(w+160,h+160),(0,0,0,0)); ImageDraw.Draw(s).rounded_rectangle((80,80+off,80+w,80+h+off),r,fill=(0,0,0,alpha)); return s.filter(ImageFilter.GaussianBlur(blur))
# logo
logo=Image.open(BASE+"logos/word_white.png").convert("RGBA"); lw=700; lh=int(logo.height*lw/logo.width); logo=logo.resize((lw,lh),Image.LANCZOS)
gl=np.array(logo); gl[...,0],gl[...,1],gl[...,2]=CYAN; gl=Image.fromarray(gl).filter(ImageFilter.GaussianBlur(14))
img.alpha_composite(gl,((W-lw)//2,250)); img.alpha_composite(logo,((W-lw)//2,250))
d=ImageDraw.Draw(img,"RGBA")
def ctext(t,y,size,col,sw=7):
    f=F(size); w_,h_=tw(d,t,f,sw); d.text(((W-w_)//2+6,y+8),t,font=f,fill=(0,0,0,200),stroke_width=sw,stroke_fill=(0,0,0,200)); d.text(((W-w_)//2,y),t,font=f,fill=col+(255,),stroke_width=sw,stroke_fill=(0,0,0,255))
ctext("PROJETO FEITO COM O CLIENTE",572,86,WHITE); ctext("ESCUTA, PRÉVIA E AJUSTES",678,64,CYAN)
# cartões das etapas
def card(kind,label):
    k=2; w=h=180; im=canvas(w*k,h*k); dd=ImageDraw.Draw(im,"RGBA")
    dd.rounded_rectangle((0,0,w*k-1,h*k-1),30*k,fill=(255,255,255,246)); dd.rounded_rectangle((0,0,w*k-1,14*k),7*k,fill=YEL+(255,)); kind_icon(dd,k,kind,90,78)
    f=F(32*k); w_=dd.textlength(label,font=f); dd.text((w*k/2-w_/2,132*k),label,font=f,fill=DARK+(255,))
    return im.resize((w,h),Image.LANCZOS).resize((270,270),Image.LANCZOS)
x0=(W-3*270-2*50)//2
for i,(kd,lb) in enumerate((("escuta","ESCUTA"),("previa","PRÉVIA"),("ajuste","AJUSTES"))):
    c=card(kd,lb); x=x0+i*320; y=790
    img.alpha_composite(shadow(270,270,40,16,150,12),(x-80,y-80)); img.alpha_composite(c,(x,y))
    if i<2:
        ax=x+270+8; d.polygon([(ax,y+120),(ax+34,y+135),(ax,y+150)],fill=CYAN+(255,),outline=DARK+(255,))
# cenário (quadro da maquete 3D no vídeo)
HW_,HH_=920,380
HDR="zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=1000,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.3:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=gamma=1.08:saturation=1.05"
raw=subprocess.run(["ffmpeg","-loglevel","error","-ss","2.2","-i",BASE+"video2/originais/IMG_1054.MOV","-frames:v","1","-vf","scale=1080:1920,"+HDR,"-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True).stdout
fr=Image.fromarray(np.frombuffer(raw,np.uint8).reshape(H,W,3)); fr=fr.crop((0,590,1080,590+int(1080*HH_/HW_))).resize((HW_,HH_),Image.LANCZOS)
mk=Image.new("L",(HW_,HH_),0); ImageDraw.Draw(mk).rounded_rectangle((0,0,HW_-1,HH_-1),46,fill=255)
hero=fr.convert("RGBA"); hero.putalpha(mk); ring=Image.new("RGBA",(HW_,HH_),(0,0,0,0)); ImageDraw.Draw(ring).rounded_rectangle((0,0,HW_-1,HH_-1),46,outline=CYAN+(255,),width=8)
cx,cy=80,1110; img.alpha_composite(shadow(HW_,HH_,46,28,190,22),(cx-80,cy-80)); img.alpha_composite(hero,(cx,cy)); img.alpha_composite(ring,(cx,cy))
d=ImageDraw.Draw(img,"RGBA")
def bar(text,bgc,fg,rot,size=66):
    f=F(size); w_,h_=tw(d,text,f); bw=w_+90; c=canvas(bw,112); cd=ImageDraw.Draw(c); cd.rounded_rectangle((0,0,bw-1,111),16,fill=bgc+(255,)); cd.text((45,12),text,font=f,fill=fg+(255,)); return c.rotate(rot,expand=True,resample=Image.BICUBIC)
b1=bar("SUA IDEIA GANHA FORMA",CYAN,DARK,1.6); b2=bar("PROJETAMOS JUNTOS",YEL,DARK,-1.6)
img.alpha_composite(shadow(b1.width-20,b1.height-20,16,14,160,10),((W-b1.width)//2-70,1435-70)); img.alpha_composite(b1,((W-b1.width)//2,1435))
img.alpha_composite(shadow(b2.width-20,b2.height-20,16,14,160,10),((W-b2.width)//2-70,1530-70)); img.alpha_composite(b2,((W-b2.width)//2,1530))
img.convert("RGB").save(BASE+"video2/capa_reuniao.png"); print("capa ok")
