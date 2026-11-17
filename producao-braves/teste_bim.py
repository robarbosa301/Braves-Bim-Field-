import importlib.util, sys, time
import numpy as np, cv2
spec = importlib.util.spec_from_file_location("cb", "/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/casa_bim.py")
cb = importlib.util.module_from_spec(spec); spec.loader.exec_module(cb)
key = sys.argv[2]; ts = [float(x) for x in sys.argv[3:]]
tiles = []
for u in ts:
    t0 = time.time(); im = cb.render(u, key); dt = time.time() - t0
    bg = np.zeros((705, 1000, 3), np.uint8); bg[:] = (52, 22, 9)
    a = im[..., 3:4] / 255.0; rgb = cv2.cvtColor(im[..., :3], cv2.COLOR_RGB2BGR)
    out = (bg * (1 - a) + rgb * a).astype(np.uint8); cv2.putText(out, f"u={u}", (20, 690), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2)
    tiles.append(cv2.resize(out, (500, 352))); print(u, round(dt, 2), "s")
rows = [np.hstack(tiles[i:i + 3]) for i in range(0, len(tiles), 3)]
cv2.imwrite(sys.argv[1], np.vstack(rows))
