import json, subprocess, os
V = "/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/video2/"; os.chdir(V)
T = json.load(open("tempos_reuniao.json")); OFF = 1.2; total = T["total"] + OFF
fc = []; labs = []
for i, sg in enumerate(T["segs"]):
    d = sg["b"] - sg["a"]; ms = int((sg["o0"] + OFF) * 1000)
    fc.append(f"[{sg['take']}:a]atrim={sg['a']:.3f}:{sg['b']:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={d-0.012:.3f}:d=0.012,adelay={ms}|{ms}[v{i}]"); labs.append(f"[v{i}]")
fc.append("".join(labs) + f"amix=inputs={len(labs)}:normalize=0:duration=longest,highpass=f=70,acompressor=threshold=-22dB:ratio=3:attack=5:release=80,apad=whole_dur={total:.2f}[voz]")
idx = {"w": 2, "i": 3, "p": 4, "d": 5}
ev = [(3, 0.02, -13), (2, 0.72, -17)] + [(idx[f], t + OFF, db) for (t, f, db) in T["sfx"]]
ev.sort(key=lambda e: e[1]); keep = []; prev = -9
for e in ev:
    if e[1] - prev >= 0.5: keep.append(e); prev = e[1]
for k, (f, t, db) in enumerate(keep):
    ms = int(t * 1000); fc.append(f"[{f}:a]volume={db}dB,adelay={ms}|{ms}[e{k}]"); labs_e = None
fc.append("[voz]" + "".join(f"[e{k}]" for k in range(len(keep))) + f"amix=inputs={len(keep)+1}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
grade = f"[6:v][7:v]concat=n=2:v=1:a=0,eq=contrast=1.04:saturation=1.05,unsharp=5:5:0.35:5:5:0.0,fade=t=out:st={total-0.3:.2f}:d=0.3[v]"
cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", "originais/Rua_Sao_Jorge_2.m4a", "-i", "originais/Rua_Sao_Jorge_3.m4a", "-i", "../video1/whoosh.wav", "-i", "../video1/impacto.wav", "-i", "../video1/pop.wav", "-i", "../video1/ding.wav",
       "-i", "intro_reuniao.mp4", "-i", "reuniao_semaudio.mp4", "-filter_complex", ";".join(fc) + ";" + grade, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
       "-pix_fmt", "yuv420p", "-crf", "25", "-preset", "medium", "-r", "30", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", "-shortest", "braves_video3_reuniao.mp4"]
r = subprocess.run(cmd, capture_output=True, text=True); print(r.stderr[-500:]); print("eventos de som:", len(keep))
