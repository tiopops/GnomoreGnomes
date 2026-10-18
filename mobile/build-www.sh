#!/usr/bin/env bash
# Copia el juego (carpeta padre) a mobile/www y escribe version.json.
# Lo usan tanto el build local como el workflow de GitHub (.github/workflows/mobile.yml).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$HERE/..}"
rm -rf "$HERE/www" && mkdir -p "$HERE/www"
( cd "$SRC" && tar cf - --exclude=.git --exclude=.github --exclude=mobile --exclude=debug --exclude=firebase \
    --exclude="Claude outputs" --exclude=CLAUDE.md --exclude=node_modules --exclude="*.bat" . ) | ( cd "$HERE/www" && tar xf - )
VER="${GG_VERSION:-$(date -u +%Y%m%d%H%M%S)}"
printf '{"version":"%s"}\n' "$VER" > "$HERE/www/version.json"
echo "www listo, version $VER, $(du -sh "$HERE/www" | cut -f1)"
