# Barna Grime · Clips del set

Plataforma para ver el set completo de Barna Grime en el Apolo y llevarse cualquier momento como clip vertical (1080x1920, MP4) listo para Reels, Shorts y TikTok.

## Cómo funciona
- El visor reproduce la versión ligera (`BARNA_GRIME_APOLO_SET_PREVIEW.mp4`, 720p).
- Al crear un clip, la página descarga solo ese tramo del original (`BARNA_GRIME_APOLO_SET_VERTICAL.mp4`, 1080p) y lo corta sin recodificar: calidad original, sincronía exacta y listo en segundos.
- El clip empieza en el corte limpio más cercano (como mucho 1 s antes de lo marcado).
- Los vídeos están en Cloudflare R2: https://pub-dd8dbcba190a4d8790c3b9fabbb9615c.r2.dev

## Publicar en GitHub Pages
1. Sube estos 4 archivos a la raíz del repositorio: index.html, mp4cut.js, logo.svg, README.md.
2. Settings → Pages → Source: "Deploy from a branch" → rama `main`, carpeta `/ (root)` → Save.
3. En un par de minutos estará en `https://TUUSUARIO.github.io/NOMBRE-DEL-REPO/`.

## Requisito en R2: regla CORS
En el bucket → Settings → CORS Policy, debe haber una regla que permita GET y HEAD desde el dominio de la web y exponga `Content-Range`, `Content-Length` y `Accept-Ranges`.

## Cambiar de set
1. Exporta el nuevo set (vertical 1080x1920, H.264, un fotograma clave cada segundo, faststart) y su versión ligera.
2. Súbelos al bucket con Cyberduck.
3. En index.html, en el bloque `SET` del principio, cambia `name`, `file`, `preview` y `source`.

## Probar sin tocar el código
`https://TUUSUARIO.github.io/NOMBRE-DEL-REPO/?preview=URL_LIGERA&source=URL_ORIGINAL`
