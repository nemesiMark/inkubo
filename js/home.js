/* Rain Ink Tattoo — home
   Prima schermata in profondità (la scritta al neon e il tatuatore si spostano col mouse
   e scorrendo) e ruota 3D dei lavori scelti dal cliente, con l'immagine a tutto schermo.
   Le facce della ruota le scrive scripts/genera_lavori.py da data/ruota.json. */
(function () {
'use strict';
var still = matchMedia('(prefers-reduced-motion: reduce)').matches,
    fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
function pad(n) { return (n < 10 ? '0' : '') + n; }

/* ---------- ruota 3D ---------- */
(function () {
  var wheel = document.getElementById('wheel'), ring = document.getElementById('ring');
  if (!wheel || !ring) return;
  var faces = [].slice.call(ring.querySelectorAll('.face')), N = faces.length;
  if (!N) { wheel.closest('section').hidden = true; return; }
  var STEP = 360 / N, name = document.getElementById('wname'), dotsBox = document.getElementById('wdots'),
      angle = 0, target = 0, idx = -1, R = 0, dragging = false, sx = 0, sa = 0, moved = 0, hover = false, seen = false, last = Date.now();
  var dots = faces.map(function (f, k) {
    var d = document.createElement('button'); d.type = 'button';
    d.setAttribute('aria-label', f.dataset.name + (f.dataset.title ? ': ' + f.dataset.title : ''));
    d.addEventListener('click', function () { var cur = Math.round(-target / STEP), off = ((k - cur) % N + N) % N; if (off > N / 2) off -= N; step(off); });
    dotsBox.appendChild(d); return d;
  });
  if (N < 2) { document.getElementById('wprev').hidden = document.getElementById('wnext').hidden = true; dotsBox.hidden = true; }

  /* raggio: abbastanza grande perché le facce vicine non si tocchino */
  function size() { var w = ring.offsetWidth; R = N < 3 ? w * .7 : Math.max(w * .6, w * .53 / Math.tan(Math.PI / N)); }
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
    ring.style.transform = 'translateZ(' + (-R) + 'px) rotateY(' + angle.toFixed(2) + 'deg)';
    faces.forEach(function (f, k) {
      var a = ((k * STEP + angle) % 360 + 540) % 360 - 180, d = Math.abs(a) / STEP;   // 0 = davanti, 1 = accanto
      f.style.transform = 'rotateY(' + (k * STEP) + 'deg) translateZ(' + R + 'px)';
      f.style.filter = 'blur(' + Math.min(d * 4, 10).toFixed(1) + 'px) brightness(' + Math.max(1 - d * .32, .25).toFixed(2) + ')';
      f.style.opacity = Math.abs(a) > 130 ? 0 : 1;
      f.style.zIndex = Math.round(100 - d * 10);
    });
    show(((Math.round(-angle / STEP)) % N + N) % N);
  }
  function go(i) { target = -i * STEP; last = Date.now(); if (still) { angle = target; render(); } }
  function step(n) { if (N > 1) go(Math.round(-target / STEP) + n); }
  document.getElementById('wprev').onclick = function () { step(-1); };
  document.getElementById('wnext').onclick = function () { step(1); };

  /* tocco senza trascinare: l'immagine davanti va a tutto schermo, una laterale viene davanti */
  function tap(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY), f = el && el.closest('.face'); if (!f) return;
    var k = faces.indexOf(f), cur = Math.round(-target / STEP), off = ((k - cur) % N + N) % N; if (off > N / 2) off -= N;
    if (off) step(off); else openLb(k);
  }
  wheel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    if (e.key === 'Enter' || e.key === ' ') { openLb(idx); e.preventDefault(); }
  });
  wheel.addEventListener('pointerdown', function (e) { dragging = true; moved = 0; sx = e.clientX; sa = angle; wheel.classList.add('drag'); wheel.setPointerCapture(e.pointerId); });
  wheel.addEventListener('pointermove', function (e) { if (!dragging) return; moved = Math.abs(e.clientX - sx); if (N > 1) angle = target = sa + (e.clientX - sx) * .35; if (still) render(); });
  function up(e) { if (!dragging) return; dragging = false; wheel.classList.remove('drag'); go(Math.round(-angle / STEP)); if (moved < 6 && e.type === 'pointerup') tap(e); }
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
    go(lbIdx); (lbBack || wheel).focus({ preventScroll: true });
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

  size(); render();
  if (still) return;
  (function loop() {
    if (seen && !hover && !dragging && !lbOpen && document.activeElement !== wheel && Date.now() - last > 4000) step(1);
    if (!dragging) angle += (target - angle) * .08;
    if (dragging || Math.abs(target - angle) > .02) render();
    requestAnimationFrame(loop);
  })();
})();

/* ---------- prima schermata in profondità ---------- */
(function () {
  var hero = document.getElementById('top'); if (!hero || still) return;
  var layers = [].slice.call(hero.querySelectorAll('.layer')), tx = 0, ty = 0, cx = 0, cy = 0;
  if (fine) window.addEventListener('mousemove', function (e) { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; });
  (function tick(t) {
    if (!fine) { tx = Math.sin(t / 2600) * .6; ty = Math.cos(t / 3400) * .4; }
    cx += (tx - cx) * .06; cy += (ty - cy) * .06;
    var sc = Math.min(scrollY, innerHeight);
    if (sc < innerHeight) layers.forEach(function (l) {
      var d = +l.dataset.d, k = +l.dataset.s;
      l.style.transform = 'translate3d(' + (-cx * d).toFixed(1) + 'px,' + (-cy * d * .6 + sc * k).toFixed(1) + 'px,0)';
    });
    requestAnimationFrame(tick);
  })(0);
})();
})();
