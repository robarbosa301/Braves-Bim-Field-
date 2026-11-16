import sys, json, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8")
audio = np.frombuffer(open(sys.argv[1],"rb").read()[44:],dtype="int16").astype("float32")/32768
segs, info = m.transcribe(audio, language="pt", word_timestamps=True, vad_filter=True, beam_size=5,
    initial_prompt="Obra, modelo 3D, vigas, laje, concretar, armar a ferragem, cobertura, térreo, pontos de hidráulica, esgoto, água, pia, vaso sanitário, chuveiro, lavanderia, banheiros.")
out=[]
for s in segs:
    for w in s.words: out.append({"w":w.word.strip(),"s":round(w.start,2),"e":round(w.end,2)})
json.dump(out, open(sys.argv[2],"w"), ensure_ascii=False); print(len(out))
