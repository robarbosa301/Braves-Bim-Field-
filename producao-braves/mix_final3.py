import json,subprocess,sys
V="BASE_AQUI/video1/"
vin,tempos,vout=sys.argv[1:4]
import os; os.chdir(V)
T=json.load(open(tempos))
segs=[(0.0,10.74),(11.98,20.58),(21.18,29.5)]
fc=[]
for i,(a,b) in enumerate(segs):
    d=b-a
    fc.append(f"[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={d-0.01:.3f}:d=0.01[s{i}]")
fc.append("[s0][s1][s2]concat=n=3:v=0:a=1,adelay=1200|1200,apad=whole_dur=29.6[voz]")
OFF=1.2
ev=[(2,0.02,-13),(1,0.72,-17)]+[(f,t+OFF,db) for (f,t,db) in [(1,0.2,-19),(1,1.85,-17),(2,2.75,-14),(2,3.62,-11),(1,4.25,-18),(3,5.85,-18),(1,T['T_FLIP']-0.05,-19),(2,T['T_VISUAL']-0.08,-10),(1,10.74,-17),(3,11.3,-17),(3,12.25,-17),(3,13.3,-17),(3,13.62,-17),(3,13.95,-17),(1,15.04,-17),(2,T['T_STAMP']+0.08,-11),
    (3,17.15,-17),(3,T['T_HELM'],-17),(3,T['T_PERS'],-17),(1,19.34,-17),(4,20.34,-17),(3,21.72,-17),(3,23.42,-17),(3,T['T_TAG'],-18),(1,24.08,-17),(4,T['T_CMT']+0.65,-17),
    (2,26.45,-11),(4,27.15,-15)]]
ev.sort(key=lambda e:e[1]); labs=[]
for k,(f,t,db) in enumerate(ev):
    ms=int(t*1000); fc.append(f"[{f}:a]volume={db}dB,adelay={ms}|{ms}[e{k}]"); labs.append(f"[e{k}]")
fc.append("[voz]"+"".join(labs)+f"amix=inputs={len(ev)+1}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
grade=("[5:v][6:v]concat=n=2:v=1:a=0,eq=contrast=1.03:saturation=1.03,unsharp=5:5:0.35:5:5:0.0,fade=t=out:st=29.3:d=0.3[v]")
cmd=["ffmpeg","-y","-loglevel","error","-i","original/d85092fc309e478386ee3aa26252ef52.mov","-i","whoosh.wav","-i","impacto.wav","-i","pop.wav","-i","ding.wav",
     "-i","intro_v.mp4","-i",vin,"-filter_complex",";".join(fc)+";"+grade,"-map","[v]","-map","[a]","-c:v","libx264","-profile:v","high","-level","4.0","-pix_fmt","yuv420p","-crf","20","-preset","slow","-r","30","-movflags","+faststart","-c:a","aac","-b:a","160k","-ar","44100","-ac","2","-shortest",vout]
print(subprocess.run(cmd,capture_output=True,text=True).stderr[-300:])
