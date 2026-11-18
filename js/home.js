/* Rain Ink Tattoo — home
   Coverflow dei lavori scelti dal cliente (una foto grande al centro, le altre inclinate ai
   lati), con l'immagine a tutto schermo. Le foto le scrive scripts/genera_lavori.py da
   data/ruota.json. La prima schermata è ferma (solo CSS). */
(function () {
'use strict';
var still = matchMedia('(prefers-reduced-motion: reduce)').matches,
    fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
function pad(n) { return (n < 10 ? '0' : '') + n; }

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
      f.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,' + z.toFixed(1) + 'px) rotateY(' + (-sg * c * 50).toFixed(2) + 'deg) scale(' + (1 - c * .2).toFixed(3) + ')';
      // le foto ai lati sono sfumate: più scure, meno colorate e un po' sfocate
      f.style.filter = 'brightness(' + (1 - c * .62 - Math.max(a - 1, 0) * .1).toFixed(2) + ') saturate(' + (1 - c * .5).toFixed(2) + ') blur(' + (c * 2.5).toFixed(1) + 'px)';
      f.style.opacity = a > 2.6 ? Math.max(0, 3.4 - a).toFixed(2) : 1;
      f.style.zIndex = Math.round(100 - a * 10);
    });
    show(((Math.round(pos)) % N + N) % N);
  }
  function go(p) { tpos = p; last = Date.now(); if (still) { pos = tpos; render(); } }
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
  function up(e) { if (!dragging) return; dragging = false; wheel.classList.remove('drag'); go(Math.round(pos)); if (moved < 6 && e.type === 'pointerup') tap(e); }
  wheel.addEventListener('pointerup', up); wheel.addEventListener('pointercancel', up);
  wheel.addEventListener('mouseenter', function () { hover = true; }); wheel.addEventListener('mouseleave', function () { hover = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }).observe(wheel);
  window.addEventListener('resize', function () { size(); render(); });

  /* tutto schermo */
  var lb = document.getElementById('lb'), lbImg = lb.querySelector('img'), lbOpen = false, lbIdx = 0, lbBack = null;
  function fill(i) {
    var f = faces[i], im = f.querySelector('img');
    lbImg.src = im.src; lbImg.alt = im.alt;
    lb.querySelector('small').textContent = f.dataset.name + ' · ' + pad(i + 1) + ' / ' + pad(N);
    lb.querySelector('figcaption span').textContent = f.dataset.title;
  }
  function openLb(i) {
    lbIdx = i; fill(i); lbBack = document.activeElement; lb.hidden = false; lbOpen = true;
    document.documentElement.style.overflow = 'hidden';
    void lb.offsetWidth; lb.classList.add('open'); lb.querySelector('.lclose').focus({ preventScroll: true });
  }
  function closeLb() {
    lb.classList.remove('open'); lbOpen = false; document.documentElement.style.overflow = '';
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
    if (e.key === 'Tab') {
      var b = [].slice.call(lb.querySelectorAll('button:not([hidden])')), i = b.indexOf(document.activeElement);
      e.preventDefault(); b[((i + (e.shiftKey ? -1 : 1)) % b.length + b.length) % b.length].focus();
    }
  });
  var lsx = 0;
  lb.addEventListener('touchstart', function (e) { lsx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - lsx; if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1); });

  /* si ferma solo se la ruota ha il fuoco da tastiera: dopo un clic o dopo la chiusura dello zoom col mouse riparte */
  function tastiera() { if (document.activeElement !== wheel) return false; try { return wheel.matches(':focus-visible'); } catch (e) { return true; } }

  size(); render();
  if (still) return;
  (function loop() {
    if (seen && !hover && !dragging && !lbOpen && !tastiera() && Date.now() - last > 4000) step(1);
    if (!dragging) pos += (tpos - pos) * .09;
    if (dragging || Math.abs(tpos - pos) > .0005) render();
    requestAnimationFrame(loop);
  })();
})();

/* ---------- video: nastro che scorre da solo; col mouse sopra si ferma e il video parte muto,
   al clic (o al tocco) si apre a tutto schermo con l'audio ---------- */
(function () {
  var box = document.querySelector('.clips');
  if (!box) return;
  var figs = [].slice.call(box.querySelectorAll('.clip'));
  if (!figs.length) { box.closest('section').hidden = true; return; }
  var dati = figs.map(function (f) { var v = f.querySelector('video'); return { src: v.getAttribute('src'), poster: v.getAttribute('poster'), titolo: f.querySelector('figcaption').textContent }; });
  var tr = document.createElement('div'); tr.className = 'clips-tr';
  figs.forEach(function (f, k) {
    var v = f.querySelector('video');
    v.removeAttribute('controls'); v.muted = true; v.loop = true; v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    f.dataset.k = k; f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', 'Guarda il video: ' + dati[k].titolo);
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

  function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); v.parentNode.classList.add('va'); }
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
    box.classList.add('fermo');
    var lb = document.createElement('div');
    lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Video a tutto schermo');
    lb.innerHTML = '<figure><video controls playsinline preload="auto"></video><figcaption><span></span><small></small></figcaption></figure><button class="lb-x" type="button" aria-label="Chiudi">✕</button><button class="lb-p" type="button" aria-label="Video precedente">←</button><button class="lb-n" type="button" aria-label="Video successivo">→</button>';
    var vd = lb.querySelector('video');
    function fill(n) {
      i = (n + dati.length) % dati.length;
      vd.pause(); vd.poster = dati[i].poster; vd.src = dati[i].src; vd.setAttribute('aria-label', dati[i].titolo);
      lb.querySelector('figcaption span').textContent = dati[i].titolo;
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
      setTimeout(function () { lb.remove(); document.body.style.overflow = ''; box.classList.remove('fermo'); if (last && last.focus) last.focus({ preventScroll: true }); }, 250);
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

/* ---------- Lo studio: due colonne di foto che scorrono in versi opposti (si fermano col mouse sopra) ---------- */
(function () {
  var box = document.getElementById('studio-cols');
  if (!box || still) return;
  var cols = box.querySelectorAll('.sc-col');
  [].forEach.call(cols, function (c) {
    if (!c.children.length) return;
    // seconda copia per il giro infinito (solo decorativa)
    [].slice.call(c.children).forEach(function (im) { var k = im.cloneNode(); k.alt = ''; k.setAttribute('aria-hidden', 'true'); c.appendChild(k); });
  });
  box.classList.add('gira');
})();

/* prima schermata: scritta e foto ferme (niente movimento col mouse o con lo scorrimento) */
})();
