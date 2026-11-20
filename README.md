# Barna Grime · Clips del set (demo)

Demo de la plataforma: ves el set en vertical, eliges un tramo (de 3 a 90 s) y el navegador lo exporta como clip 1080x1920 listo para Reels, Shorts y TikTok.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub y sube estos 4 archivos tal cual (index.html, logo.svg, BARNA_GRIME_APOLO_CLIP3.mp4, README.md).
2. En el repositorio: Settings → Pages → Source: "Deploy from a branch" → rama `main`, carpeta `/ (root)` → Save.
3. En un par de minutos estará en `https://TUUSUARIO.github.io/NOMBRE-DEL-REPO/`.

## Probarlo en local
Abre una terminal en esta carpeta y ejecuta `python3 -m http.server`, luego entra en http://localhost:8000
(abrir index.html con doble clic no funciona: el navegador bloquea el vídeo).

## Notas
- Mejor en Chrome o Safari actualizados: sale MP4. En Firefox sale WebM.
- El clip se genera en tiempo real: uno de 30 s tarda 30 s. Deja la pestaña visible mientras tanto.
- En el móvil, "Guardar en el dispositivo" abre el menú de compartir para guardarlo en la galería.
