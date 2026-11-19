/* Rain Ink Tattoo — home
   Coverflow dei lavori scelti dal cliente (una foto grande al centro, le altre inclinate ai
   lati), con l'immagine a tutto schermo. Le foto le scrive scripts/genera_lavori.py da
   data/ruota.json. La prima schermata è ferma (solo CSS). */
(function () {
'use strict';
var still = matchMedia('(prefers-reduced-motion: reduce)').matches,
    fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
// descrizione sotto il titolo nelle foto e nei video ingranditi (provvisoria, uguale per tutti finché non se ne scrive una propria in data-desc)
var DESC_FOTO = "Un lavoro nato in studio da un'idea del cliente e disegnato su misura. Ogni linea e ogni sfumatura sono pensate per durare nel tempo.",
    DESC_VIDEO = "Una seduta in studio vista da vicino, dalla prima linea all'ultima sfumatura. Attiva l'audio per viverla come se fossi lì.";
function pad(n) { return (n < 10 ? '0' : '') + n; }
// animazioni che girano da sole: ferme quando non si vedono
function fuoriSchermo(el) {
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (es) { el.classList.toggle('fuori', !es[0].isIntersecting); }, { rootMargin: '200px 0px' }).observe(el);
}

/* ---------- coverflow dei lavori: una foto grande al centro, le altre inclinate ai lati ---------- */
(function () {
  var wheel = document.getElementById('wheel'), ring = document.getElementById('ring');
  if (!wheel || !ring) return;
  var faces = [].slice.call(ring.querySelectorAll('.face')), N = faces.length;
  if (!N) { wheel.closest('section').hidden = true; return; }
  var name = document.getElementById('wname'), dotsBox = document.getElementById('wdots'),
      pos = 0, tpos = 0, idx = -1, W = 0, dragging = false, sx = 0, sp = 0, moved = 0, hover = false, seen = false, last = Date.now();
  // posizione (senza «giri») più vicina a quella attuale in cui la foto k sta al centro
  function near(k) { var c = Math.round(tpos), off = ((k - c) % N + N) % N; if (off > N / 2) off -= N; return c + off; }
  var dots = faces.map(function (f, k) {
    var d = document.createElement('button'); d.type = 'button';
    d.setAttribute('aria-label', f.dataset.name + (f.dataset.title ? ': ' + f.dataset.title : ''));
    d.addEventListener('click', function () { go(near(k)); });
    dotsBox.appendChild(d); return d;
  });
  if (N < 2) { document.getElementById('wprev').hidden = document.getElementById('wnext').hidden = true; dotsBox.hidden = true; }

  // le foto ai lati sono più scure, meno colorate e sfocate: invece di ricalcolare un filtro a ogni
  // fotogramma (lento), ogni foto ha sopra una copia già sfocata e un velo scuro, e cambia solo la loro opacità
  // la copia sfocata è disegnata una volta sola in un riquadro piccolo (ingrandito sembra sfocato) e
  // con meno colore: nessun filtro da calcolare mentre la ruota gira
  function sfoca(im, cv) {
    function draw() {
      if (!im.naturalWidth) return;
      var w = 240, h = 300, pw = 120, ph = 150, r = 14 * w / Math.max(ring.offsetWidth, 1);
      var p = document.createElement('canvas'); p.width = pw; p.height = ph;
      var pc = p.getContext('2d'), sc = Math.max(pw / im.naturalWidth, ph / im.naturalHeight);
      pc.imageSmoothingEnabled = true; pc.imageSmoothingQuality = 'high';
      pc.drawImage(im, (pw - im.naturalWidth * sc) / 2, (ph - im.naturalHeight * sc) / 2, im.naturalWidth * sc, im.naturalHeight * sc);
      try {
        var d = pc.getImageData(0, 0, pw, ph), a = d.data;
        for (var j = 0; j < a.length; j += 4) { var g = .2126 * a[j] + .7152 * a[j + 1] + .0722 * a[j + 2]; a[j] = g + (a[j] - g) * .5; a[j + 1] = g + (a[j + 1] - g) * .5; a[j + 2] = g + (a[j + 2] - g) * .5; }
        pc.putImageData(d, 0, 0);
      } catch (e) {}
      cv.width = w; cv.height = h;
      var c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(p, 0, 0, w, h);
      // angoli arrotondati disegnati qui, così il riquadro non ha bisogno di ritagli mentre si muove
      c.globalCompositeOperation = 'destination-in'; c.beginPath();
      if (c.roundRect) c.roundRect(0, 0, w, h, r); else c.rect(0, 0, w, h);
      c.fill();
    }
    if (im.complete) draw(); else im.addEventListener('load', draw);
  }
  var veli = faces.map(function (f) {
    var im = f.querySelector('img'), sf = document.createElement('canvas'); sf.className = 'sf'; sf.setAttribute('aria-hidden', 'true');
    f.insertBefore(sf, im.nextSibling); sfoca(im, sf);
    var om = document.createElement('i'); om.className = 'ombra'; om.setAttribute('aria-hidden', 'true'); f.insertBefore(om, sf.nextSibling);
    return { sf: sf, om: om, v: {} };
  });
  // scrive uno stile solo se è cambiato (meno lavoro per il browser a ogni fotogramma)
  function set(k, el, prop, val) { var c = veli[k].v, key = prop + (el === faces[k] ? '' : el.className); if (c[key] !== val) { c[key] = val; el.style[prop] = val; } }
  function size() { W = ring.offsetWidth; }
  function show(i) {
    if (i === idx) return; idx = i;
    dots.forEach(function (d, k) { d.setAttribute('aria-current', String(k === i)); });
    faces.forEach(function (f, k) { f.classList.toggle('front', k === i); });
    name.classList.add('swap');
    setTimeout(function () {
      name.querySelector('small').textContent = pad(i + 1) + ' / ' + pad(N) + (faces[i].dataset.title ? ' · ' + faces[i].dataset.title : '');
      name.querySelector('b').textContent = faces[i].dataset.name;
      name.classList.remove('swap');
    }, still ? 0 : 180);
  }
  function render() {
    faces.forEach(function (f, k) {
      var o = ((k - pos) % N + N) % N; if (o > N / 2) o -= N;          // 0 = al centro, ±1 = accanto
      var a = Math.abs(o), c = Math.min(a, 1), sg = o < 0 ? -1 : 1;
      var x = o * W * .3 + sg * c * W * .32, z = (1 - c) * 90 - a * 40;
      f.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,' + z.toFixed(2) + 'px) rotateY(' + (-sg * c * 50).toFixed(3) + 'deg) scale(' + (1 - c * .2).toFixed(4) + ')';
      set(k, veli[k].sf, 'opacity', c.toFixed(3));
      set(k, veli[k].om, 'opacity', Math.min(1, c * .62 + Math.max(a - 1, 0) * .1).toFixed(3));
      set(k, f, 'opacity', a > 2.6 ? Math.max(0, 3.4 - a).toFixed(3) : '1');
      set(k, f, 'zIndex', String(Math.round(100 - a * 10)));
    });
    show(((Math.round(pos)) % N + N) % N);
  }
  // ogni passaggio è un movimento a tempo con partenza e arrivo morbidi, uguale su schermi a 60 o 120 Hz
  // (dopo un trascinamento la foto si assesta senza ripartire piano: frenata finale e basta)
  var from = 0, t0 = 0, dur = 0, soloFrenata = false;
  function ease(t) { return soloFrenata ? 1 - Math.pow(1 - t, 3) : t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function go(p, frenata) {
    last = Date.now();
    if (still) { pos = tpos = p; render(); return; }
    soloFrenata = !!frenata;
    from = pos; tpos = p; t0 = performance.now();
    dur = frenata ? 420 : Math.min(1400, 750 + 220 * Math.abs(p - pos));
  }
  function step(n) { if (N > 1) go(Math.round(tpos) + n); }
  document.getElementById('wprev').onclick = function () { step(-1); };
  document.getElementById('wnext').onclick = function () { step(1); };

  /* tocco senza trascinare: la foto al centro va a tutto schermo, una laterale viene al centro */
  function tap(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY), f = el && el.closest('.face'); if (!f) return;
    var k = faces.indexOf(f), p = near(k);
    if (p !== Math.round(tpos)) go(p); else openLb(k);
  }
  wheel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    if (e.key === 'Enter' || e.key === ' ') { openLb(idx); e.preventDefault(); }
  });
  wheel.addEventListener('pointerdown', function (e) { dragging = true; moved = 0; sx = e.clientX; sp = pos; wheel.classList.add('drag'); wheel.setPointerCapture(e.pointerId); });
  wheel.addEventListener('pointermove', function (e) { if (!dragging) return; moved = Math.abs(e.clientX - sx); if (N > 1) pos = tpos = sp - (e.clientX - sx) / (W * .55); if (still) render(); });
  function up(e) { if (!dragging) return; dragging = false; wheel.classList.remove('drag'); go(Math.round(pos), true); if (moved < 6 && e.type === 'pointerup') tap(e); }
  wheel.addEventListener('pointerup', up); wheel.addEventListener('pointercancel', up);
  wheel.addEventListener('mouseenter', function () { hover = true; }); wheel.addEventListener('mouseleave', function () { hover = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }).observe(wheel);
  window.addEventListener('resize', function () { size(); render(); });

  /* tutto schermo */
  var lb = document.getElementById('lb'), lbImg = lb.querySelector('img'), lbOpen = false, lbIdx = 0, lbBack = null;
  function fill(i) {
    var f = faces[i], im = f.querySelector('img');
    lbImg.src = im.src; lbImg.alt = im.alt;
    lb.querySelector('figcaption span').textContent = f.dataset.name;
    lb.querySelector('.lb-desc').textContent = f.dataset.desc || DESC_FOTO;
    lb.querySelector('small').textContent = pad(i + 1) + ' / ' + pad(N) + (f.dataset.title ? ' · ' + f.dataset.title : '');
    vetro.style.backgroundImage = 'url("' + im.src + '")'; vetro.classList.remove('su');
  }
  /* LENTE: come nelle altre gallerie; interruttore in alto a sinistra, acceso compare un cerchio che
     ingrandisce i dettagli (col mouse passandoci sopra, col dito tenendolo sulla foto). Scelta ricordata. */
  var sw = lb.querySelector('.lb-lente'), vetro = lb.querySelector('.lb-vetro'), aiuto = lb.querySelector('.lb-aiuto'), LZ = 2.6, lenteOn = false;
  try { lenteOn = localStorage.getItem('rainink-lente') === '1'; } catch (e) {}
  function lente(on) {
    lenteOn = on; sw.setAttribute('aria-checked', on); lb.classList.toggle('lente-on', on); vetro.classList.remove('su');
    try { localStorage.setItem('rainink-lente', on ? '1' : '0'); } catch (e) {}
    aiuto.textContent = on ? (matchMedia('(pointer: coarse)').matches ? 'Tieni il dito sulla foto e muovilo per guardarla da vicino.' : 'Passa il mouse sulla foto per guardarla da vicino.') : '';
  }
  function muovi(e) {
    if (!lenteOn) return;
    var r = lbImg.getBoundingClientRect(), f = lbImg.parentNode.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { vetro.classList.remove('su'); return; }
    var m = vetro.offsetWidth / 2;
    vetro.classList.add('su');
    vetro.style.left = (r.left - f.left + x) + 'px'; vetro.style.top = (r.top - f.top + y) + 'px';
    vetro.style.backgroundSize = (r.width * LZ) + 'px ' + (r.height * LZ) + 'px';
    vetro.style.backgroundPosition = (-x * LZ + m) + 'px ' + (-y * LZ + m) + 'px';
  }
  sw.addEventListener('click', function () { lente(!lenteOn); });
  lbImg.addEventListener('pointermove', muovi);
  lbImg.addEventListener('pointerdown', function (e) { if (lenteOn) { e.preventDefault(); lbImg.setPointerCapture(e.pointerId); muovi(e); } });
  lbImg.addEventListener('pointerleave', function () { vetro.classList.remove('su'); });
  lbImg.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') vetro.classList.remove('su'); });
  lente(lenteOn);
  function openLb(i) {
    lbIdx = i; fill(i); lbBack = document.activeElement; lb.hidden = false; lbOpen = true;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.classList.add('zoom'); void lb.offsetWidth; lb.classList.add('open'); lb.querySelector('.lclose').focus({ preventScroll: true });
  }
  function closeLb() {
    lb.classList.remove('open'); lbOpen = false; document.documentElement.style.overflow = ''; document.documentElement.classList.remove('zoom');
    setTimeout(function () { if (!lbOpen) lb.hidden = true; }, still ? 0 : 300);
    hover = wheel.matches(":hover"); go(near(lbIdx)); (lbBack || wheel).focus({ preventScroll: true });
  }
  function lbStep(n) {
    if (N < 2) return;
    lbIdx = ((lbIdx + n) % N + N) % N;
    if (still) { fill(lbIdx); return; }
    lb.style.setProperty('--dir', (n > 0 ? -20 : 20) + 'deg'); lb.classList.add('slide');
    setTimeout(function () {
      fill(lbIdx); lb.style.setProperty('--dir', (n > 0 ? 20 : -20) + 'deg');
      void lb.offsetWidth; lb.classList.remove('slide');
    }, 180);
  }
  lb.querySelector('.lprev').onclick = function () { lbStep(-1); };
  lb.querySelector('.lnext').onclick = function () { lbStep(1); };
  lb.querySelector('.lclose').onclick = closeLb;
  if (N < 2) lb.querySelector('.lprev').hidden = lb.querySelector('.lnext').hidden = true;
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (!lbOpen) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowRight') lbStep(1);
    if (e.key === 'ArrowLeft') lbStep(-1);
    if (e.key === 'l' || e.key === 'L') lente(!lenteOn);
    if (e.key === 'Tab') {
      var b = [].slice.call(lb.querySelectorAll('button:not([hidden])')), i = b.indexOf(document.activeElement);
      e.preventDefault(); b[((i + (e.shiftKey ? -1 : 1)) % b.length + b.length) % b.length].focus();
    }
  });
  var lsx = 0;
  lb.addEventListener('touchstart', function (e) { lsx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) { if (lenteOn && e.target === lbImg) return; var dx = e.changedTouches[0].clientX - lsx; if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1); });

  /* si ferma solo se la ruota ha il fuoco da tastiera: dopo un clic o dopo la chiusura dello zoom col mouse riparte */
  function tastiera() { if (document.activeElement !== wheel) return false; try { return wheel.matches(':focus-visible'); } catch (e) { return true; } }

  size(); render();
  if (still) return;
  var drawn = NaN;
  (function loop(now) {
    if (seen && !hover && !dragging && !lbOpen && !tastiera() && Date.now() - last > 4000) step(1);
    if (!dragging) pos = dur && now - t0 < dur ? from + (tpos - from) * ease(Math.max(0, now - t0) / dur) : tpos;
    if (pos !== drawn) { drawn = pos; render(); }
    requestAnimationFrame(loop);
  })(performance.now());
})();

/* ---------- video: nastro che scorre da solo; col mouse sopra si ferma e il video parte muto,
   al clic (o al tocco) si apre a tutto schermo con l'audio ---------- */
(function () {
  var box = document.querySelector('.clips');
  if (!box) return;
  var figs = [].slice.call(box.querySelectorAll('.clip'));
  if (!figs.length) { box.closest('section').hidden = true; return; }
  var dati = figs.map(function (f) { var v = f.querySelector('video'); return { src: v.getAttribute('src'), poster: v.getAttribute('poster'), titolo: f.querySelector('figcaption').textContent, desc: f.getAttribute('data-desc') }; });
  var tr = document.createElement('div'); tr.className = 'clips-tr';
  figs.forEach(function (f, k) {
    var v = f.querySelector('video');
    v.removeAttribute('controls'); v.muted = true; v.loop = true; v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    f.dataset.k = k; f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', 'Guarda il video: ' + dati[k].titolo);
    // nel nastro si vede la copertina (un'immagine, leggera); il video compare solo quando parte
    var cop = document.createElement('img'); cop.className = 'clip-cop'; cop.src = dati[k].poster; cop.alt = ''; cop.setAttribute('aria-hidden', 'true');
    cop.decoding = 'async'; cop.draggable = false; f.insertBefore(cop, v);
    var pl = document.createElement('span'); pl.className = 'clip-pl'; pl.setAttribute('aria-hidden', 'true'); f.insertBefore(pl, f.firstChild.nextSibling);
    tr.appendChild(f);
  });
  // seconda copia per il giro infinito (solo decorativa: niente lettori di schermo né tab)
  figs.forEach(function (f) { var c = f.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; c.removeAttribute('role'); c.removeAttribute('aria-label'); c.classList.add('clip-copia'); tr.appendChild(c); });
  box.appendChild(tr); box.classList.add('nastro');
  box.removeAttribute('tabindex'); box.setAttribute('aria-label', 'Video');
  // durata del giro in proporzione alla lunghezza, così la velocità resta la stessa
  function durata() { tr.style.animationDuration = Math.max(20, tr.scrollWidth / 2 / 45) + 's'; }
  durata(); addEventListener('resize', durata);
  fuoriSchermo(box);

  function play(v) { v.parentNode.classList.add('va'); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function stop(v) { v.pause(); v.parentNode.classList.remove('va'); }
  [].forEach.call(tr.children, function (f) {
    var v = f.querySelector('video');
    if (fine) {
      f.addEventListener('mouseenter', function () { play(v); });
      f.addEventListener('mouseleave', function () { stop(v); });
    }
    f.addEventListener('click', function () { apri(+f.dataset.k, f); });
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(+f.dataset.k, f); } });
  });

  function apri(i, da) {
    var last = da || document.activeElement;
    box.classList.add('fermo'); document.documentElement.classList.add('zoom');
    var lb = document.createElement('div');
    lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Video a tutto schermo');
    lb.innerHTML = '<figure><video controls playsinline preload="auto"></video><figcaption><span></span><p class="lb-desc"></p><small></small></figcaption></figure><button class="lb-x" type="button" aria-label="Chiudi">✕</button><button class="lb-p" type="button" aria-label="Video precedente">←</button><button class="lb-n" type="button" aria-label="Video successivo">→</button>';
    var vd = lb.querySelector('video');
    function fill(n) {
      i = (n + dati.length) % dati.length;
      vd.pause(); vd.poster = dati[i].poster; vd.src = dati[i].src; vd.setAttribute('aria-label', dati[i].titolo);
      lb.querySelector('figcaption span').textContent = dati[i].titolo;
      lb.querySelector('.lb-desc').textContent = dati[i].desc || DESC_VIDEO;
      lb.querySelector('figcaption small').textContent = pad(i + 1) + ' / ' + pad(dati.length);
      var p = vd.play(); if (p && p.catch) p.catch(function () {});
    }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') fill(i - 1);
      else if (e.key === 'ArrowRight') fill(i + 1);
      else if (e.key === 'Tab') {
        var f = [].slice.call(lb.querySelectorAll('button, video')), a = f.indexOf(document.activeElement);
        e.preventDefault(); f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    function close() {
      document.removeEventListener('keydown', key); vd.pause(); lb.classList.add('out');
      setTimeout(function () { lb.remove(); document.body.style.overflow = ''; box.classList.remove('fermo'); document.documentElement.classList.remove('zoom'); if (last && last.focus) last.focus({ preventScroll: true }); }, 250);
    }
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.lb-p').addEventListener('click', function () { fill(i - 1); });
    lb.querySelector('.lb-n').addEventListener('click', function () { fill(i + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
    var sx = 0;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) fill(i + (dx < 0 ? 1 : -1)); });
    document.addEventListener('keydown', key);
    [].forEach.call(tr.querySelectorAll('video'), stop);
    fill(i);
    document.body.appendChild(lb); document.body.style.overflow = 'hidden';
    lb.querySelector('.lb-x').focus();
  }
})();

/* ---------- Lo studio: due colonne di foto che scorrono in versi opposti, senza fermarsi ---------- */
(function () {
  var box = document.getElementById('studio-cols');
  if (!box || still) return;
  var cols = box.querySelectorAll('.sc-col');
  [].forEach.call(cols, function (c) {
    if (!c.children.length) return;
    // seconda copia per il giro infinito (solo decorativa)
    // foto caricate subito e decodificate a parte: niente scatti quando entrano in vista mentre scorrono
    [].slice.call(c.children).forEach(function (im) {
      im.loading = 'eager'; im.decoding = 'async';
      var k = im.cloneNode(); k.alt = ''; k.setAttribute('aria-hidden', 'true'); c.appendChild(k);
    });
  });
  box.classList.add('gira');
  fuoriSchermo(box);
})();

/* prima schermata: scritta e foto ferme (niente movimento col mouse o con lo scorrimento) */
})();
