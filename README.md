# Barna Grime · Clips del set (demo)

Demo de la plataforma: ves el set en vertical, eliges un tramo (de 3 a 90 s) y el navegador lo exporta como clip 1080x1920 listo para Reels, Shorts y TikTok.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub y sube estos 5 archivos tal cual (index.html, mp4cut.js, logo.svg, BARNA_GRIME_APOLO_CLIP3.mp4, README.md).
2. En el repositorio: Settings → Pages → Source: "Deploy from a branch" → rama `main`, carpeta `/ (root)` → Save.
3. En un par de minutos estará en `https://TUUSUARIO.github.io/NOMBRE-DEL-REPO/`.

## Probarlo en local
Abre una terminal en esta carpeta y ejecuta `python3 -m http.server`, luego entra en http://localhost:8000
(abrir index.html con doble clic no funciona: el navegador bloquea el vídeo).

## Notas
- Funciona en cualquier navegador actual, también en iPhone. El clip sale siempre en MP4.
- El clip se corta directamente del vídeo, sin recodificar: tarda segundos, mantiene la calidad original y el audio queda perfectamente sincronizado. Empieza en el corte limpio más cercano (como mucho 1 s antes de lo marcado).
- En el móvil, "Guardar en el dispositivo" abre el menú de compartir para guardarlo en la galería.
