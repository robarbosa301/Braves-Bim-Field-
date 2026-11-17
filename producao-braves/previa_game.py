import subprocess, math, importlib.util
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
BASE="BASE_AQUI/"; V2=BASE+"video2/"
W,H=1080,1920
def F(s): return ImageFont.truetype(BASE+"fontes/Anton-Regular.ttf",s)
def M(s,w=800):
    f=ImageFont.truetype(BASE+"fontes/Montserrat.ttf",s)
    try: f.set_variation_by_axes([w])
    except Exception: pass
    return f
HDR="zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=1000,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.3:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=gamma=1.08:saturation=1.05"
def frame(clip,ss):
    raw=subprocess.run(["ffmpeg","-loglevel","error","-ss",str(ss),"-i",V2+"originais/"+clip,"-frames:v","1","-vf","scale=1080:1920,"+HDR,"-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True).stdout
    return np.frombuffer(raw,np.uint8).reshape(H,W,3).astype(np.float32)
PINK=np.array((255,70,150),np.float32); ORANGE=np.array((255,150,40),np.float32); PURPLE=np.array((90,30,140),np.float32); GOLD=np.array((255,200,60),np.float32)
def sunset_grade(img, strength=1.0):
    g=img.mean(axis=2,keepdims=True)/255.0
    # mapa de gradiente: sombras roxas -> médios rosa -> luzes laranja/dourado
    lo=PURPLE*0.5; mid=PINK; hi=ORANGE*1.05+np.array((0,40,40))
    gm=np.where(g<0.5, lo+(mid-lo)*(g/0.5), mid+(hi-mid)*((g-0.5)/0.5))
    out=img*(1-0.55*strength)+gm*(0.55*strength)
    out=np.clip((out-128)*1.12+128+8,0,255)
    yy=np.linspace(0,1,H)[:,None,None]; sky=(PINK*(1-yy)+ORANGE*yy)*0.18*(1-yy)
    out=out+sky*strength
    xx,yy2=np.meshgrid(np.linspace(-1,1,W),np.linspace(-1,1,H)); vig=1-0.45*(xx**2*0.6+yy2**2*0.8); out=out*np.clip(vig,0.45,1)[...,None]
    bl=cv2.GaussianBlur(np.clip(out-170,0,255).astype(np.float32),(0,0),28); out=out+bl*0.8
    return np.clip(out,0,255).astype(np.uint8)
def grad_text(img,text,font,xy,c0=(255,90,160),c1=(255,170,60),stroke=0,anchor="la",shadow=True):
    im=Image.fromarray(img).convert("RGBA"); d0=ImageDraw.Draw(im)
    bb=d0.textbbox(xy,text,font=font,anchor=anchor); w_,h_=bb[2]-bb[0],bb[3]-bb[1]
    mask=Image.new("L",im.size,0); ImageDraw.Draw(mask).text(xy,text,font=font,fill=255,anchor=anchor)
    g=np.zeros((im.height,im.width,3),np.uint8); t=np.clip((np.arange(im.height)-bb[1])/max(1,h_),0,1)[:,None]
    for c in range(3): g[...,c]=(c0[c]*(1-t)+c1[c]*t).astype(np.uint8)
    if shadow:
        sh=Image.new("RGBA",im.size,(0,0,0,0)); ImageDraw.Draw(sh).text((xy[0]+5,xy[1]+7),text,font=font,fill=(30,0,40,200),anchor=anchor); im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3)))
    layer=Image.fromarray(g).convert("RGBA"); layer.putalpha(mask)
    if stroke:
        so=Image.new("RGBA",im.size,(0,0,0,0)); ImageDraw.Draw(so).text(xy,text,font=font,fill=(255,255,255,255),anchor=anchor,stroke_width=stroke,stroke_fill=(255,255,255,255)); im.alpha_composite(so)
    im.alpha_composite(layer); return np.array(im.convert("RGB"))
def hud_pill(img,xy,wh,fill=(20,10,40,170),outline=(255,255,255,90)):
    im=Image.fromarray(img).convert("RGBA"); ov=Image.new("RGBA",im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    d.rounded_rectangle((xy[0],xy[1],xy[0]+wh[0],xy[1]+wh[1]),24,fill=fill,outline=outline,width=3); im.alpha_composite(ov); return np.array(im.convert("RGB"))
# ---------- quadro 1: abertura / cartão do personagem ----------
f1=sunset_grade(frame("IMG_1054.MOV",2.2),1.0)
f1=grad_text(f1,"PROJETO",F(190),(540,330),anchor="mm",stroke=0)
f1=grad_text(f1,"EM CONJUNTO",F(120),(540,500),anchor="mm",c0=(255,120,150),c1=(255,190,70))
im=Image.fromarray(f1); d=ImageDraw.Draw(im,"RGBA")
d.rounded_rectangle((60,1230,640,1420),22,fill=(20,8,36,150),outline=(255,255,255,70),width=3)
d.text((90,1250),"ROGÉRIO OTÁVIO",font=F(66),fill=(255,255,255,255)); d.text((92,1330),"ENGENHEIRO CIVIL",font=M(34,700),fill=(255,170,90,255)); d.line((92,1318,420,1318),fill=(255,90,160,255),width=4)
d.text((92,1376),"BRAVES  |  CONSTRUÇÕES EFICIENTES",font=M(24,600),fill=(255,255,255,200))
f1=np.array(im)
# ---------- quadro 2: HUD de missão sobre a simulação BIM ----------
_sp=importlib.util.spec_from_file_location("cb",BASE+"casa_bim.py"); cb=importlib.util.module_from_spec(_sp); _sp.loader.exec_module(cb)
sky=np.zeros((H,W,3),np.float32); yy=np.linspace(0,1,H)[:,None]
for c in range(3): sky[...,c]=(PURPLE[c]*(1-yy)*0.8+PINK[c]*np.clip(1-abs(yy-0.45)*2.2,0,1)+ORANGE[c]*np.clip((yy-0.4)*1.8,0,1))[:,0][:,None]
sun=np.zeros((H,W),np.float32); cv2.circle(sun,(540,820),240,1.0,-1); sun=cv2.GaussianBlur(sun,(0,0),30); sky+=sun[...,None]*np.array((255,200,100))*0.6
f2=np.clip(sky,0,255).astype(np.uint8)
r=cb.render(9.4,"B"); r=r[40:650,60:940]; rr=cv2.resize(r,(1040,int(610*1040/880)),interpolation=cv2.INTER_AREA)
base=Image.fromarray(f2).convert("RGBA"); base.alpha_composite(Image.fromarray(rr),(20,520)); f2=np.array(base.convert("RGB"))
f2=cv2.addWeighted(f2,1.0,cv2.GaussianBlur(f2,(0,0),20),0.18,0)
f2=hud_pill(f2,(60,250),(520,360))
im=Image.fromarray(f2); d=ImageDraw.Draw(im,"RGBA")
d.text((90,270),"OBJETIVO",font=M(28,800),fill=(255,170,90,255))
d.text((90,312),"Projetar junto com o cliente",font=M(36,800),fill=(255,255,255,255))
for i,(t,ok) in enumerate((("Escutar a ideia",True),("Apresentar a prévia",True),("Ajustar cada detalhe",False))):
    y=392+i*68; d.rounded_rectangle((90,y,134,y+44),10,outline=(255,255,255,230),width=4,fill=((255,90,160,255) if ok else (0,0,0,0)))
    if ok: d.line([(100,y+24),(110,y+34),(126,y+12)],fill=(255,255,255,255),width=6)
    d.text((152,y+2),t,font=M(32,700),fill=(255,255,255,255 if not ok else 190))
# minimapa (planta)
d.ellipse((760,250,1000,490),fill=(20,10,40,190),outline=(255,255,255,200),width=6)
for (x0,y0,x1,y1) in ((800,300,960,300),(960,300,960,440),(960,440,800,440),(800,440,800,300),(880,300,880,380),(800,380,960,380)):
    d.line((x0,y0,x1,y1),fill=(255,170,90,255),width=5)
d.polygon([(880,420),(870,440),(890,440)],fill=(255,90,160,255))
# barra de progresso
d.rounded_rectangle((60,1560,1020,1640),26,fill=(20,10,40,180),outline=(255,255,255,90),width=3)
d.text((90,1570),"PROGRESSO DO PROJETO",font=M(24,800),fill=(255,255,255,210))
d.rounded_rectangle((90,1606,990,1626),10,fill=(255,255,255,50)); d.rounded_rectangle((90,1606,700,1626),10,fill=(255,120,150,255))
f2=np.array(im)
# ---------- quadro 3: MISSÃO CUMPRIDA ----------
f3=sunset_grade(frame("IMG_1090.MOV",19.0),0.9)
ov=np.zeros((H,W,3),np.float32); ov[...]=np.array((20,5,40)); f3=np.clip(f3*0.75+ov*0.25,0,255).astype(np.uint8)
im=Image.fromarray(f3).convert("RGBA"); band=Image.new("RGBA",im.size,(0,0,0,0)); ImageDraw.Draw(band).rectangle((0,760,W,1160),fill=(15,5,30,150)); im.alpha_composite(band); f3=np.array(im.convert("RGB"))
f3=grad_text(f3,"MISSÃO",F(230),(540,900),anchor="mm",c0=(255,210,90),c1=(255,150,40))
f3=grad_text(f3,"CUMPRIDA",F(230),(540,1090),anchor="mm",c0=(255,210,90),c1=(255,150,40))
im=Image.fromarray(f3); d=ImageDraw.Draw(im,"RGBA"); w_=d.textlength("PROJETO APROVADO COM O CLIENTE",font=M(38,800)); d.text(((W-w_)/2,1210),"PROJETO APROVADO COM O CLIENTE",font=M(38,800),fill=(255,255,255,255)); f3=np.array(im)
tiles=[Image.fromarray(x).resize((540,960),Image.LANCZOS) for x in (f1,f2,f3)]
sh=Image.new("RGB",(540*3+40,960),(10,6,20)); 
for i,t in enumerate(tiles): sh.paste(t,(i*560,0))
sh.save(V2+"previa_estilo_game.png"); print(sh.size)
