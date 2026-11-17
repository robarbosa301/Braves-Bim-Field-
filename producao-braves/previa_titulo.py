import math, importlib.util
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
BASE="/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"; V2=BASE+"video2/"
exec(open(BASE+"previa_game.py").read().split("# ---------- quadro 1")[0])
bg=np.clip(frame("IMG_1054.MOV",2.2),0,255).astype(np.uint8)
def MB(sz,w=900):
    f=ImageFont.truetype(BASE+"fontes/Montserrat.ttf",sz)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
def AN(sz): return ImageFont.truetype(BASE+"fontes/Anton-Regular.ttf",sz)
def base():
    return Image.fromarray(bg).convert("RGBA")
def center(d,txt,f,y,fill,stroke=0,sf=None):
    w=d.textlength(txt,font=f); d.text(((1080-w)/2,y),txt,font=f,fill=fill,stroke_width=stroke,stroke_fill=sf)
def A():   # placa escura + faixa rosa
    im=base(); d=ImageDraw.Draw(im,"RGBA"); y=255
    d.rounded_rectangle((80,y,1000,y+250),34,fill=(24,8,40,235),outline=(255,64,140,255),width=6)
    center(d,"SEU PROJETO",MB(84),y+28,(255,255,255,255)); center(d,"FEITO COM VOCÊ",MB(84),y+128,(255,214,90,255))
    return im
def B():   # pergunta em caixa amarela (alto impacto)
    im=base(); d=ImageDraw.Draw(im,"RGBA"); y=270
    d.rounded_rectangle((70,y,1010,y+130),30,fill=(255,214,40,255)); d.rounded_rectangle((70,y+16,1010,y+146),30,fill=(24,8,40,255)); d.rounded_rectangle((70,y,1010,y+130),30,fill=(255,214,40,255))
    center(d,"VOCÊ JÁ PROJETOU ASSIM?",MB(56),y+36,(24,8,40,255))
    d.rounded_rectangle((250,y+150,830,y+235),24,fill=(255,64,140,255)); center(d,"JUNTO COM A GENTE",MB(48),y+168,(255,255,255,255))
    return im
def C():   # neon rosa/ciano
    im=base(); lay=Image.new("RGBA",im.size,(0,0,0,0)); d=ImageDraw.Draw(lay)
    for i,(t,c) in enumerate((("PROJETE",(255,64,140)),("COM A GENTE",(70,230,255)))):
        f=MB(130 if i==0 else 104); w=d.textlength(t,font=f); d.text(((1080-w)/2,255+i*150),t,font=f,fill=c+(255,))
    gl=lay.filter(ImageFilter.GaussianBlur(14)); im.alpha_composite(gl); im.alpha_composite(gl); 
    d2=ImageDraw.Draw(im)
    for i,t in enumerate(("PROJETE","COM A GENTE")):
        f=MB(130 if i==0 else 104); w=d2.textlength(t,font=f); d2.text(((1080-w)/2,255+i*150),t,font=f,fill=(255,255,255,255),stroke_width=3,stroke_fill=((255,64,140) if i==0 else (70,230,255)))
    return im
ims=[x().convert("RGB").resize((540,960),Image.LANCZOS) for x in (A,B,C)]
out=Image.new("RGB",(1620+40,960),(20,10,30)); 
for i,x in enumerate(ims): out.paste(x,(i*560,0))
out.save(V2+"previa_titulo.png")
