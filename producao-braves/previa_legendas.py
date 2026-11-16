import subprocess, math
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
BASE="/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"; V=BASE+"video1/"
W,H=1080,1920
YEL,CYAN,WHITE,DARK=(255,196,0),(0,229,255),(255,255,255),(20,20,24)
ANTON=BASE+"fontes/Anton-Regular.ttf"; MONT=BASE+"fontes/Montserrat.ttf"
def anton(s): return ImageFont.truetype(ANTON,s)
def mont(s,w=800):
    f=ImageFont.truetype(MONT,s)
    try: f.set_variation_by_axes([w])
    except Exception as e: pass
    return f
# --- base: fundo de projeto + cartão com você ---
bg=np.zeros((H,W,3),np.float32)
for c,(a,b) in enumerate(zip((16,40,92),(5,12,34))): bg[...,c]=np.linspace(a,b,H)[:,None]
for i in range(0,W,60): bg[:,i]=bg[:,i]*0.88+np.array(CYAN)*0.12
for j in range(0,H,60): bg[j,:]=bg[j,:]*0.88+np.array(CYAN)*0.12
base=Image.fromarray(np.clip(bg,0,255).astype(np.uint8)).convert("RGBA")
HDR="zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=1000,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.3:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=gamma=1.08:saturation=1.05"
raw=subprocess.run(["ffmpeg","-loglevel","error","-ss","9.0","-i",V+"original/IMG_2302.MOV","-frames:v","1","-vf",f"crop=1022:1816:1080:785,scale={W}:{H}:flags=lanczos,{HDR}","-f","rawvideo","-pix_fmt","rgb24","-"],capture_output=True).stdout
sp=Image.fromarray(np.frombuffer(raw,np.uint8).reshape(H,W,3))
sc=0.574; small=sp.resize((int(W*sc),int(H*sc)),Image.LANCZOS)
card=Image.new("RGBA",(620,490)); card.paste(small.crop((230-230,940-702,230-230+620,940-702+490)),(0,0))
mk=Image.new("L",(620,490),0); ImageDraw.Draw(mk).rounded_rectangle((0,0,619,489),36,fill=255); card.putalpha(mk)
base.alpha_composite(card,(230,940)); ImageDraw.Draw(base).rounded_rectangle((230,940,849,1429),36,outline=CYAN+(255,),width=6)
WORDS=["O","NOSSO","CLIENTE"]; ACT=2; CY=1485
def centered(d,items,fonts,gap):
    ws=[d.textlength(t,font=f) for t,f in zip(items,fonts)]; x=(W-sum(ws)-gap*(len(ws)-1))/2; out=[]
    for w_ in ws: out.append(x); x+=w_+gap
    return out,ws
def style_A(img,col=YEL):   # Impacto
    d=ImageDraw.Draw(img); f=anton(92); xs,ws=centered(d,WORDS,[f]*3,26)
    for i,(t,x) in enumerate(zip(WORDS,xs)): d.text((x,CY-70),t,font=f,fill=(col if i==ACT else WHITE)+(255,),stroke_width=8,stroke_fill=(0,0,0,255))
def style_C(img):           # caixa na palavra
    d=ImageDraw.Draw(img); f=mont(64); xs,ws=centered(d,WORDS,[f]*3,30)
    for i,(t,x,w_) in enumerate(zip(WORDS,xs,ws)):
        if i==ACT:
            d.rounded_rectangle((x-22,CY-62,x+w_+22,CY+36),22,fill=CYAN+(255,)); d.text((x,CY-52),t,font=f,fill=DARK+(255,))
        else: d.text((x,CY-52),t,font=f,fill=WHITE+(255,),stroke_width=6,stroke_fill=(0,0,0,255))
def style_D(img):           # pulso
    d=ImageDraw.Draw(img); fn=mont(58); fa=mont(74); fonts=[fa if i==ACT else fn for i in range(3)]; xs,ws=centered(d,WORDS,fonts,28)
    for i,(t,x) in enumerate(zip(WORDS,xs)):
        d.text((x,CY-(50 if i!=ACT else 58)),t,font=fonts[i],fill=(YEL if i==ACT else WHITE)+(255,),stroke_width=5,stroke_fill=(0,0,0,255))
def style_E(img):           # fita inclinada
    strip=Image.new("RGBA",(1000,150),(0,0,0,0)); sd=ImageDraw.Draw(strip); sd.rectangle((0,10,999,140),fill=(14,18,28,235)); sd.rectangle((0,10,14,140),fill=CYAN+(255,))
    f=mont(56); xs,ws=centered(sd,WORDS,[f]*3,24); x0=60
    for i,(t,w_) in enumerate(zip(WORDS,ws)):
        sd.text((x0,40),t,font=f,fill=(CYAN if i==ACT else WHITE)+(255,)); x0+=w_+24
    strip=strip.rotate(4,expand=True,resample=Image.BICUBIC); img.alpha_composite(strip,(40,CY-105))
def style_F(img):           # painel moderno translúcido
    d=ImageDraw.Draw(img); f=mont(56,700); txt=["o","nosso","cliente"]; xs,ws=centered(d,txt,[f]*3,22); pad=44
    x0,x1=xs[0]-pad,xs[-1]+ws[-1]+pad
    panel=Image.new("RGBA",(W,H),(0,0,0,0)); pd=ImageDraw.Draw(panel); pd.rounded_rectangle((x0,CY-64,x1,CY+42),34,fill=(9,22,52,200),outline=(255,255,255,70),width=2)
    img.alpha_composite(panel); d=ImageDraw.Draw(img)
    for i,(t,x,w_) in enumerate(zip(txt,xs,ws)):
        d.text((x,CY-50),t,font=f,fill=(WHITE if i!=ACT else CYAN)+(255,))
        if i==ACT: d.rounded_rectangle((x,CY+30,x+w_,CY+35),3,fill=CYAN+(255,))
variants=[("A  ATUAL: Impacto amarelo",lambda im:style_A(im,YEL)),("B  Impacto azul-ciano (cor da marca)",lambda im:style_A(im,CYAN)),
          ("C  Caixa na palavra (azul)",style_C),("D  Pulso (palavra cresce, amarelo)",style_D),
          ("E  Fita inclinada",style_E),("F  Painel moderno (vidro escuro)",style_F)]
tiles=[]
for name,fn in variants:
    im=base.copy(); fn(im); d=ImageDraw.Draw(im)
    crop=im.crop((0,1220,W,1680)).convert("RGB"); cd=ImageDraw.Draw(crop); f=mont(34,700)
    cd.rounded_rectangle((16,14,16+cd.textlength(name,font=f)+28,70),14,fill=(255,255,255)); cd.text((30,22),name,font=f,fill=DARK)
    tiles.append(crop)
sheet=Image.new("RGB",(W*2+30,460*3+60),(8,12,24))
for i,t in enumerate(tiles): sheet.paste(t,((i%2)*(W+30),(i//2)*(460+30)))
sheet=sheet.resize((1600,int(sheet.height*1600/sheet.width)),Image.LANCZOS); sheet.save(V+"previas_legendas.png"); print(sheet.size)
