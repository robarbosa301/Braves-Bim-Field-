import subprocess, math
import numpy as np, cv2
from PIL import Image
V = "/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/video1/"
W, H, FPS = 1080, 1920, 30
CYAN, WHITE = (0, 229, 255), (255, 255, 255)
def ease(p): p = min(max(p, 0.0), 1.0); return 1 - (1 - p) ** 3
def easeio(p): p = min(max(p, 0.0), 1.0); return 3 * p * p - 2 * p ** 3
cover = np.array(Image.open(V + "capa_braves.png").convert("RGB"))
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", V + "v21_semaudio.mp4", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
main0 = np.frombuffer(raw, np.uint8).reshape(H, W, 3).copy()
def zm(img, z):
    M = np.float32([[z, 0, W / 2 - z * W / 2], [0, z, H / 2 - z * H / 2]]); return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
def tr_lens(prev, cur, p):
    e = easeio(p); cx, cy = W // 2, H // 2
    out = (zm(prev, 1 + 0.10 * e).astype(np.float32) * (1 - 0.45 * e)).astype(np.uint8)
    r = int(12 + e * 1300); inner = zm(cur, 1.12 - 0.12 * e)
    mk = np.zeros((H, W), np.uint8); cv2.circle(mk, (cx, cy), r, 255, -1); out[mk > 0] = inner[mk > 0]
    if r < 1250:
        cv2.circle(out, (cx, cy), r, (0, 0, 0), 22, cv2.LINE_AA); cv2.circle(out, (cx, cy), r, CYAN, 12, cv2.LINE_AA)
        cv2.circle(out, (cx, cy), max(2, r - 20), WHITE, 3, cv2.LINE_AA)
        rot = e * 120
        for a_ in range(0, 360, 6):
            ang = math.radians(a_ + rot); ln = 36 if a_ % 30 == 0 else 18
            p0 = (int(cx + math.cos(ang) * (r - 30)), int(cy + math.sin(ang) * (r - 30))); p1 = (int(cx + math.cos(ang) * (r - 30 - ln)), int(cy + math.sin(ang) * (r - 30 - ln)))
            cv2.line(out, p0, p1, WHITE, 3 if a_ % 30 == 0 else 2, cv2.LINE_AA)
        for a_ in (0, 90, 180, 270):
            ang = math.radians(a_ + rot * 0.3); p0 = (int(cx + math.cos(ang) * (r + 18)), int(cy + math.sin(ang) * (r + 18))); p1 = (int(cx + math.cos(ang) * (r + 90)), int(cy + math.sin(ang) * (r + 90)))
            cv2.line(out, p0, p1, CYAN, 6, cv2.LINE_AA)
        cv2.line(out, (cx - 26, cy), (cx + 26, cy), WHITE, 3); cv2.line(out, (cx, cy - 26), (cx, cy + 26), WHITE, 3)
    return out
wr = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                       "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", V + "intro_v.mp4"], stdin=subprocess.PIPE)
N1, N2 = 24, 12
yy, xx = np.mgrid[0:H, 0:W]
last = None
for i in range(N1):
    p = i / (N1 - 1); fr = zm(cover, 1.0 + 0.035 * ease(p)).astype(np.float32)
    # brilho passando na diagonal
    pos = -300 + ease((p - 0.1) / 0.6) * (W + H + 600); d = (xx + yy * 0.5) - pos
    sh = np.exp(-(d / 110.0) ** 2) * 0.28 if 0.1 < p < 0.75 else 0
    if np.ndim(sh): fr += sh[..., None] * 255
    last = np.clip(fr, 0, 255).astype(np.uint8); wr.stdin.write(last.tobytes())
for i in range(N2):
    wr.stdin.write(tr_lens(last, main0, (i + 1) / N2).tobytes())
wr.stdin.close(); wr.wait(); print("intro ok", (N1 + N2) / FPS)
