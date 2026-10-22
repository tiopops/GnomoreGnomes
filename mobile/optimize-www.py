#!/usr/bin/env python3
"""Solo para la APK: reduce las imágenes PNG demasiado grandes de mobile/www/assets.
Se ejecuta DESPUÉS de build-www.sh sobre la copia (mobile/www); la carpeta original del
juego y la versión web NO se tocan. Mismos nombres de archivo, así que el código no cambia.
Uso: python3 mobile/optimize-www.py mobile/www"""
import os, re, sys
from PIL import Image

MAX_SIDE = 768        # lado máximo de un sprite en la APK (un móvil lo muestra a ~200-450 px)
SKIP_TIER = re.compile(r"_(lowres|midres)\.png$")            # ya son versiones reducidas
SKIP_TERRAIN = re.compile(r"(^|/)(losetas|decals)/|/(agua_\d|tierra|piedra|hierbajos)[^/]*\.png$|fog|niebla", re.I)  # el canvas del suelo usa su tamaño real

def main(root):
    assets = os.path.join(root, "assets")
    before = after = n = 0
    for dp, _, fs in os.walk(assets):
        for f in fs:
            if not f.lower().endswith(".png") or SKIP_TIER.search(f):
                continue
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, assets).replace("\\", "/")
            if SKIP_TERRAIN.search("/" + rel):
                continue
            size = os.path.getsize(p)
            try:
                im = Image.open(p)
                w, h = im.size
                if max(w, h) <= MAX_SIDE or max(w, h) > 1600:
                    continue
                k = MAX_SIDE / max(w, h)
                im = im.convert("RGBA") if im.mode not in ("RGBA", "RGB", "LA", "L") else im
                im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
                im.save(p, optimize=True)
            except Exception as e:
                print("saltado", rel, e)
                continue
            before += size; after += os.path.getsize(p); n += 1
    print(f"optimizadas {n} imágenes: {before/1048576:.1f} MB -> {after/1048576:.1f} MB")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "mobile/www")
