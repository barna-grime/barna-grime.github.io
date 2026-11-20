/* mp4cut.js — corta un tramo de un MP4 sin recodificar (copia de flujo).
   Lee solo la cabecera (moov) y los bytes del tramo mediante peticiones Range.
   Vídeo: empieza en el fotograma clave anterior al inicio pedido. Audio: alineado al vídeo con lista de edición.
   Uso: const r = await MP4Cut.cut(url, inicio, fin, progreso) → { blob, start, end } */
(function (root) {
  'use strict';
  const td = new TextDecoder('latin1');

  async function fetchRange(url, a, b) {
    const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer());
    if (r.status === 200) return { data: buf.subarray(a, b + 1), total: buf.length, full: buf };
    const cr = r.headers.get('Content-Range'); const total = cr ? +cr.split('/')[1] : NaN;
    return { data: buf, total };
  }
  async function fetchRangeProgress(url, a, b, onp) {
    const r = await fetch(url, { headers: { Range: `bytes=${a}-${b}` } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const want = b - a + 1;
    if (r.status === 200) { const all = new Uint8Array(await r.arrayBuffer()); return all.subarray(a, b + 1); }
    const out = new Uint8Array(want); let got = 0;
    const reader = r.body.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; out.set(value, got); got += value.length; onp && onp(got / want); }
    if (got !== want) throw new Error('rango incompleto');
    return out;
  }

  // ---------- lectura de cajas ----------
  function hdr(u8, i) {
    const dv = new DataView(u8.buffer, u8.byteOffset + i);
    let size = dv.getUint32(0), h = 8; const type = td.decode(u8.subarray(i + 4, i + 8));
    if (size === 1) { size = Number(dv.getBigUint64(8)); h = 16; } else if (size === 0) size = u8.length - i;
    return { size, h, type };
  }
  function kids(u8, s, e) { const out = []; let i = s; while (i + 8 <= e) { const b = hdr(u8, i); out.push({ type: b.type, start: i, h: b.h, end: i + b.size, u8 }); if (b.size < 8) break; i += b.size; } return out; }
  const find = (list, t) => list.find(b => b.type === t);
  const kidsOf = b => kids(b.u8, b.start + b.h, b.end);
  const raw = b => b.u8.slice(b.start, b.end);
  const dvOf = b => new DataView(b.u8.buffer, b.u8.byteOffset + b.start + b.h, b.end - b.start - b.h);

  function readTrack(trak) {
    const tk = kidsOf(trak), mdia = find(tk, 'mdia'), mk = kidsOf(mdia), minf = find(mk, 'minf'), nk = kidsOf(minf), stbl = find(nk, 'stbl'), sk = kidsOf(stbl);
    const hd = dvOf(find(mk, 'hdlr')); const handler = td.decode(new Uint8Array(hd.buffer, hd.byteOffset + 8, 4));
    const md = dvOf(find(mk, 'mdhd')); const timescale = md.getUint8(0) === 1 ? md.getUint32(20) : md.getUint32(12);
    // lista de edición original
    let mediaTime = 0, emptyDur = 0; const edts = find(tk, 'edts');
    if (edts) { const el = find(kidsOf(edts), 'elst'); if (el) { const d = dvOf(el), v = d.getUint8(0), n = d.getUint32(4); let p = 8;
      for (let k = 0; k < n; k++) { const dur = v ? Number(d.getBigUint64(p)) : d.getUint32(p); const mt = v ? Number(d.getBigInt64(p + 8)) : d.getInt32(p + 4); p += v ? 20 : 12;
        if (mt === -1) emptyDur += dur; else { mediaTime = mt; break; } } } }
    // tablas
    const sz = dvOf(find(sk, 'stsz')); const fixed = sz.getUint32(4), n = sz.getUint32(8);
    const size = new Uint32Array(n); for (let k = 0; k < n; k++) size[k] = fixed || sz.getUint32(12 + 4 * k);
    const dts = new Float64Array(n), dur = new Uint32Array(n); { const d = dvOf(find(sk, 'stts')), c = d.getUint32(4); let k = 0, t = 0;
      for (let e = 0; e < c; e++) { const cnt = d.getUint32(8 + 8 * e), dl = d.getUint32(12 + 8 * e); for (let j = 0; j < cnt && k < n; j++, k++) { dts[k] = t; dur[k] = dl; t += dl; } } }
    const cto = new Int32Array(n); let cttsVer = -1; const ct = find(sk, 'ctts');
    if (ct) { const d = dvOf(ct); cttsVer = d.getUint8(0); const c = d.getUint32(4); let k = 0;
      for (let e = 0; e < c; e++) { const cnt = d.getUint32(8 + 8 * e), off = cttsVer ? d.getInt32(12 + 8 * e) : d.getUint32(12 + 8 * e); for (let j = 0; j < cnt && k < n; j++, k++) cto[k] = off; } }
    let sync = null; const ss = find(sk, 'stss');
    if (ss) { const d = dvOf(ss), c = d.getUint32(4); sync = new Uint8Array(n); for (let e = 0; e < c; e++) sync[d.getUint32(8 + 4 * e) - 1] = 1; }
    let chunks; const co = find(sk, 'stco') || find(sk, 'co64');
    { const d = dvOf(co), c = d.getUint32(4), big = co.type === 'co64'; chunks = new Float64Array(c); for (let e = 0; e < c; e++) chunks[e] = big ? Number(d.getBigUint64(8 + 8 * e)) : d.getUint32(8 + 4 * e); }
    const offset = new Float64Array(n); { const d = dvOf(find(sk, 'stsc')), c = d.getUint32(4); let k = 0;
      for (let e = 0; e < c; e++) { const first = d.getUint32(8 + 12 * e) - 1, spc = d.getUint32(12 + 12 * e); const next = e + 1 < c ? d.getUint32(8 + 12 * (e + 1)) - 1 : chunks.length;
        for (let ch = first; ch < next && k < n; ch++) { let o = chunks[ch]; for (let j = 0; j < spc && k < n; j++, k++) { offset[k] = o; o += size[k]; } } } }
    return { trak, tk, mk, nk, sk, handler, timescale, mediaTime, emptyDur, n, size, dts, dur, cto, cttsVer, sync, offset };
  }

  // ---------- escritura ----------
  const u32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0); return b; };
  const i32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v); return b; };
  function cat(parts) { let L = 0; for (const p of parts) L += p.length; const o = new Uint8Array(L); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; }
  function box(type, ...parts) { const body = cat(parts); const o = new Uint8Array(8 + body.length); const dv = new DataView(o.buffer); dv.setUint32(0, o.length); for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i); o.set(body, 8); return o; }
  const full = (type, ver, flags, ...parts) => box(type, u32((ver << 24) | flags), ...parts);
  function patchDur(b, isTkhd, value) { // tkhd/mdhd: devuelve copia con duración nueva (en v1 se reescribe 64 bits)
    const o = raw(b), dv = new DataView(o.buffer), v = o[b.h], p = b.h + 4;
    if (isTkhd) { if (v === 1) dv.setBigUint64(p + 24, BigInt(value)); else dv.setUint32(p + 16, value); }
    else { if (v === 1) dv.setBigUint64(p + 20, BigInt(value)); else dv.setUint32(p + 12, value); }
    return o;
  }

  function buildTrak(T, sel, newId, movieTs, segDur, mediaStart, chunkOffset) {
    const { a, b } = sel, n = b - a + 1;
    let mediaDur = 0; for (let k = a; k <= b; k++) mediaDur += T.dur[k];
    const stts = []; for (let k = a; k <= b; k++) { const last = stts[stts.length - 1]; if (last && last[1] === T.dur[k]) last[0]++; else stts.push([1, T.dur[k]]); }
    const stsdRaw = raw(find(T.sk, 'stsd'));
    const out = [stsdRaw, full('stts', 0, 0, u32(stts.length), ...stts.flatMap(([c, d]) => [u32(c), u32(d)]))];
    if (T.cttsVer >= 0) { const rows = []; for (let k = a; k <= b; k++) { const last = rows[rows.length - 1]; if (last && last[1] === T.cto[k]) last[0]++; else rows.push([1, T.cto[k]]); }
      out.push(full('ctts', T.cttsVer, 0, u32(rows.length), ...rows.flatMap(([c, o]) => [u32(c), T.cttsVer ? i32(o) : u32(o)]))); }
    if (T.sync) { const idx = []; for (let k = a; k <= b; k++) if (T.sync[k]) idx.push(k - a + 1); out.push(full('stss', 0, 0, u32(idx.length), ...idx.map(u32))); }
    out.push(full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)));
    const sizes = []; for (let k = a; k <= b; k++) sizes.push(u32(T.size[k]));
    out.push(full('stsz', 0, 0, u32(0), u32(n), ...sizes));
    out.push(full('stco', 0, 0, u32(1), u32(chunkOffset)));
    const stbl = box('stbl', ...out);
    const minfKids = T.nk.filter(k => k.type !== 'stbl').map(raw);
    const minf = box('minf', ...minfKids, stbl);
    const mdiaKids = T.mk.map(k => k.type === 'minf' ? minf : k.type === 'mdhd' ? patchDur(k, false, mediaDur) : raw(k));
    const mdia = box('mdia', ...mdiaKids);
    const tkhd = patchDur(find(T.tk, 'tkhd'), true, segDur); new DataView(tkhd.buffer).setUint32(find(T.tk, 'tkhd').h + 4 + (tkhd[find(T.tk, 'tkhd').h] === 1 ? 16 : 8), newId);
    const elst = full('elst', 0, 0, u32(1), u32(segDur), i32(mediaStart), u32(0x00010000));
    return box('trak', tkhd, box('edts', elst), mdia);
  }

  async function cut(url, tIn, tOut, onProgress) {
    onProgress && onProgress(0, 'Leyendo el índice del vídeo…');
    // localizar ftyp y moov
    const first = await fetchRange(url, 0, 15); const total = first.total;
    if (!(total > 0)) throw new Error('El servidor no indica el tamaño del archivo');
    let ftyp = null, moov = null, pos = 0;
    while (pos < total && !(ftyp && moov)) {
      const r = await fetchRange(url, pos, Math.min(total - 1, pos + 15)); const h = hdr(r.data, 0);
      const size = h.size || (total - pos);
      if (h.type === 'ftyp' || h.type === 'moov') { const all = (await fetchRange(url, pos, pos + size - 1)).data; const b = { type: h.type, start: 0, h: h.h, end: size, u8: all }; if (h.type === 'ftyp') ftyp = b; else moov = b; }
      if (size < 8) throw new Error('MP4 no válido');
      pos += size;
    }
    if (!moov) throw new Error('No se encontró el índice (moov)');
    const mk = kidsOf(moov), tracks = mk.filter(b => b.type === 'trak').map(readTrack);
    const V = tracks.find(t => t.handler === 'vide'), A = tracks.find(t => t.handler === 'soun');
    if (!V) throw new Error('Sin pista de vídeo');
    const mvhd = dvOf(find(mk, 'mvhd')); const movieTs = mvhd.getUint8(0) === 1 ? mvhd.getUint32(20) : mvhd.getUint32(12);
    const pv = k => (V.dts[k] + V.cto[k] - V.mediaTime) / V.timescale + V.emptyDur / movieTs;
    // vídeo: fotograma clave anterior (o igual) al inicio
    let K = 0; for (let k = 0; k < V.n; k++) if ((!V.sync || V.sync[k]) && pv(k) <= tIn + 1e-6) K = k;
    const startP = pv(K);
    let E = K; for (let k = K; k < V.n; k++) if (pv(k) < tOut - 1e-6) E = k;
    const endP = Math.min(tOut, pv(E) + V.dur[E] / V.timescale);
    const segSec = endP - startP, segDur = Math.round(segSec * movieTs);
    const vSel = { a: K, b: E }, vMediaStart = V.cto[K];
    let aSel = null, aMediaStart = 0;
    if (A) { const pa = k => (A.dts[k] - A.mediaTime) / A.timescale + A.emptyDur / movieTs;
      let j = 0; for (let k = 0; k < A.n; k++) { if (pa(k) <= startP + 1e-9) j = k; else break; }
      let e = j; for (let k = j; k < A.n; k++) { if (pa(k) < endP) e = k; else break; }
      aSel = { a: j, b: e }; aMediaStart = Math.max(0, Math.round((startP - pa(j)) * A.timescale)); }
    // bytes a descargar
    let lo = Infinity, hi = 0; const span = (T, s) => { for (let k = s.a; k <= s.b; k++) { lo = Math.min(lo, T.offset[k]); hi = Math.max(hi, T.offset[k] + T.size[k]); } };
    span(V, vSel); if (aSel) span(A, aSel);
    onProgress && onProgress(0, 'Descargando el tramo…');
    const data = await fetchRangeProgress(url, lo, hi - 1, p => onProgress && onProgress(p, 'Descargando el tramo…'));
    const take = (T, s) => { let L = 0; for (let k = s.a; k <= s.b; k++) L += T.size[k]; const o = new Uint8Array(L); let i = 0; for (let k = s.a; k <= s.b; k++) { o.set(data.subarray(T.offset[k] - lo, T.offset[k] - lo + T.size[k]), i); i += T.size[k]; } return o; };
    const vData = take(V, vSel), aData = aSel ? take(A, aSel) : new Uint8Array(0);
    // montar moov dos veces (la segunda con desplazamientos reales)
    const mkMoov = (vOff, aOff) => {
      const mvhdNew = full('mvhd', 0, 0, u32(0), u32(0), u32(movieTs), u32(segDur), u32(0x00010000), new Uint8Array([1, 0]), new Uint8Array(10),
        u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000), new Uint8Array(24), u32(A ? 3 : 2));
      const traks = [buildTrak(V, vSel, 1, movieTs, segDur, vMediaStart, vOff)];
      if (aSel) traks.push(buildTrak(A, aSel, 2, movieTs, segDur, aMediaStart, aOff));
      return box('moov', mvhdNew, ...traks);
    };
    const ftypRaw = ftyp ? raw(ftyp) : box('ftyp', new TextEncoder().encode('isom'), u32(512), new TextEncoder().encode('isomiso2avc1mp41'));
    let moovB = mkMoov(0, 0);
    const mdatStart = ftypRaw.length + moovB.length;
    moovB = mkMoov(mdatStart + 8, mdatStart + 8 + vData.length);
    const mdatHdr = new Uint8Array(8); new DataView(mdatHdr.buffer).setUint32(0, 8 + vData.length + aData.length); mdatHdr.set([109, 100, 97, 116], 4);
    onProgress && onProgress(1, 'Listo');
    return { blob: new Blob([ftypRaw, moovB, mdatHdr, vData, aData], { type: 'video/mp4' }), start: startP, end: endP };
  }
  root.MP4Cut = { cut };
})(window);
