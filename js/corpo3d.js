/* Rain Ink Tattoo — figura umana in 3D nella presentazione della home (sotto la prima schermata).
   Gira da sola; col mouse sopra la figura si decide verso e velocità (a sinistra gira
   a sinistra, a destra gira a destra, al centro si ferma; in alto e in basso si inclina);
   togliendo il mouse riprende a girare. Su telefono si gira trascinando col dito.
   Tatuaggi disegnati qui sotto: manica giapponese sul braccio, blackwork sulla gamba,
   ornamento sul collo. Usa three.js (js/vendor/three.min.js). */
(function () {
'use strict';
var cv = document.querySelector('.body3d');
if (!cv) return;
var box = cv.closest('section') || cv.parentNode;
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* senza WebGL o senza three.js resta la falena disegnata */
function useFallback() {
  var img = cv.parentNode.querySelector('.art-fallback'), hint = document.querySelector('.art-hint');
  if (img) {
    img.hidden = false;
  }
  if (hint) hint.remove();
  cv.remove();
}
if (!window.THREE) return useFallback();
var renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); }
catch (e) { return useFallback(); }
renderer.setClearColor(0x000000, 0);

var SKIN = '#ecdccb', INK = '#1b1a1a', RED = '#c4372a', PINK = '#f2b8c0', ORANGE = '#e4683a';

/* numeri casuali sempre uguali, così i tatuaggi non cambiano a ogni apertura */
function rng(s) { return function () { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var TAU = Math.PI * 2;

/* ======================================================
   TATUAGGI: ogni parte ha un disegno su tela che le si avvolge attorno.
   In orizzontale la tela fa il giro dell'arto (centro = davanti, bordi = dietro),
   in verticale va dall'alto (spalla, anca, testa) al basso.
   ====================================================== */
function tattoo(w, h, len, circ, draw) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.fillStyle = SKIN; g.fillRect(0, 0, w, h);
  var k = (w / circ) / (h / len);           // così i cerchi restano cerchi sulla pelle
  g.setTransform(k, 0, 0, 1, 0, 0);
  g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g, w / k, h);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
/* disegna una forma anche oltre il bordo, perché il giro si chiude dietro senza tagli */
function around(L, x, fn) { [x - L, x, x + L].forEach(fn); }
function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }

/* braccio: manica giapponese su fondo nero con barre del vento, sole rosso e fiori
   di ciliegio sul braccio, nuvole al gomito, onde e carpa koi sull'avambraccio */
function sleeve(g, L, H) {
  var rnd = rng(7), top = 70, bot = 935, x, i;
  g.save();
  g.beginPath();
  g.moveTo(0, top);
  for (x = 0; x <= L; x += 3) g.lineTo(x, top + Math.sin(x / L * TAU * 3) * 14);
  for (x = L; x >= 0; x -= 3) g.lineTo(x, bot + Math.sin(x / L * TAU * 6) * 9);
  g.closePath();
  g.clip();
  g.fillStyle = INK; g.fillRect(-L, 0, L * 3, H);

  /* barre del vento */
  g.strokeStyle = SKIN;
  for (i = 0; i < 80; i++) {
    var bx = rnd() * L, by = top + 25 + rnd() * 480, bl = 26 + rnd() * 60, bw = 3 + rnd() * 4;
    around(L, bx, function (ox) { g.lineWidth = bw; g.beginPath(); g.moveTo(ox, by); g.lineTo(ox + bl * .9, by - bl * .42); g.stroke(); });
  }

  /* onde a scaglie (seigaiha) */
  var Rr = L / 12, row = 0;
  for (var y = 585; y < bot + Rr; y += Rr / 2, row++) {
    for (x = (row % 2) * Rr - 2 * Rr; x < L + 2 * Rr; x += 2 * Rr) {
      g.fillStyle = INK; dot(g, x, y, Rr);
      g.strokeStyle = SKIN; g.lineWidth = 2.6;
      [Rr - 3, Rr * .72, Rr * .46].forEach(function (r) { g.beginPath(); g.arc(x, y, r, Math.PI, TAU); g.stroke(); });
      g.fillStyle = SKIN; dot(g, x, y, Rr * .18);
    }
  }

  /* nuvole al gomito */
  for (i = 0; i < 5; i++) {
    around(L, i * L / 5 + 20, function (cx) {
      var cy = 565 + (i % 2) * 14, s = 26;
      g.fillStyle = SKIN;
      [[-1.05, .25, .78], [0, -.2, 1], [1.05, .25, .78]].forEach(function (c) { dot(g, cx + c[0] * s, cy + c[1] * s, c[2] * s); });
      g.strokeStyle = INK; g.lineWidth = 3;
      [[-1.05, .25, .78], [0, -.2, 1], [1.05, .25, .78]].forEach(function (c) { g.beginPath(); g.arc(cx + c[0] * s, cy + c[1] * s, c[2] * s * .55, Math.PI * 1.1, Math.PI * 2.2); g.stroke(); });
    });
  }

  /* sole rosso davanti */
  g.fillStyle = SKIN; dot(g, L / 2, 250, 96);
  g.fillStyle = RED; dot(g, L / 2, 250, 86);

  /* fiori di ciliegio */
  function blossom(x0, y0, s, rot) {
    around(L, x0, function (x1) {
      g.save(); g.translate(x1, y0); g.rotate(rot);
      for (var p = 0; p < 5; p++) {
        g.save(); g.rotate(p * TAU / 5);
        g.beginPath(); g.moveTo(0, 0);
        g.bezierCurveTo(-s * .58, -s * .35, -s * .52, -s, -s * .14, -s);
        g.lineTo(0, -s * .84); g.lineTo(s * .14, -s);
        g.bezierCurveTo(s * .52, -s, s * .58, -s * .35, 0, 0);
        g.fillStyle = PINK; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
        g.restore();
      }
      g.fillStyle = RED; dot(g, 0, 0, s * .2);
      g.restore();
    });
  }
  blossom(L / 2 - 92, 140, 34, .3); blossom(L / 2 + 96, 345, 30, 1.1); blossom(L / 2 + 88, 150, 22, .7);
  blossom(L / 2 - 80, 380, 24, 2.1); blossom(L * .08, 260, 32, .5); blossom(L * .9, 420, 26, 1.6); blossom(L * .2, 450, 20, .2);

  /* carpa koi che risale l'avambraccio */
  g.save(); g.translate(L / 2, 760); g.rotate(-.32); g.scale(1.05, 1.05);
  var body = new Path2D('M0 -112 C 34 -106 50 -62 46 -12 C 42 32 22 62 8 84 L 42 130 C 22 126 7 116 0 105 C -7 116 -22 126 -42 130 L -8 84 C -22 62 -42 32 -46 -12 C -50 -62 -34 -106 0 -112 Z');
  var fins = new Path2D('M-40 -34 C -86 -24 -92 12 -74 26 C -64 8 -52 -6 -38 -12 Z M40 -34 C 86 -24 92 12 74 26 C 64 8 52 -6 38 -12 Z');
  g.lineWidth = 16; g.strokeStyle = SKIN; g.stroke(body); g.stroke(fins);
  g.fillStyle = ORANGE; g.fill(fins); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke(fins);
  g.fill(body);
  g.save(); g.clip(body);
  g.fillStyle = SKIN; g.beginPath(); g.ellipse(18, 10, 30, 46, .4, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(-20, 60, 18, 26, -.3, 0, TAU); g.fill();
  g.fillStyle = RED; g.beginPath(); g.ellipse(0, -84, 30, 26, 0, 0, TAU); g.fill();
  g.strokeStyle = INK; g.lineWidth = 1.6;
  for (var sy = -50; sy < 80; sy += 14) for (var sx = -48; sx < 50; sx += 16) { g.beginPath(); g.arc(sx + (sy / 14 % 2 ? 8 : 0), sy, 8, .15 * Math.PI, .85 * Math.PI); g.stroke(); }
  g.restore();
  g.lineWidth = 4; g.strokeStyle = INK; g.stroke(body);
  g.fillStyle = INK; dot(g, -19, -82, 4.5); dot(g, 19, -82, 4.5);
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(-14, -112); g.quadraticCurveTo(-30, -140, -18, -160); g.moveTo(14, -112); g.quadraticCurveTo(30, -140, 18, -160); g.stroke();
  g.restore();
  g.restore();
}

/* gamba: blackwork e geometria — mandala sulla coscia, sfumatura a puntini, fascia
   a denti sul ginocchio, anello di triangoli e catena di rombi sul polpaccio */
function legWork(g, L, H) {
  var rnd = rng(11), i, x, y;
  g.fillStyle = INK; g.strokeStyle = INK;
  /* puntinato che sfuma verso il ginocchio */
  for (i = 0; i < 2600; i++) {
    x = rnd() * L; y = 150 + rnd() * 310;
    if (Math.hypot(x - L / 2, y - 300) < 140) continue;
    if (rnd() < Math.pow((470 - y) / 320, 1.6)) dot(g, x, y, 1 + rnd() * 1.3);
  }
  /* mandala */
  g.save(); g.translate(L / 2, 300);
  var M = 122;
  for (i = 0; i < 48; i++) dot(g, Math.cos(i / 48 * TAU) * M, Math.sin(i / 48 * TAU) * M, 2.6);
  function petal(r0, r1, w) { g.beginPath(); g.moveTo(0, -r0); g.quadraticCurveTo(w, -(r0 + r1) / 2, 0, -r1); g.quadraticCurveTo(-w, -(r0 + r1) / 2, 0, -r0); }
  for (i = 0; i < 16; i++) {
    g.save(); g.rotate(i * TAU / 16);
    petal(M * .52, M * .93, 22); g.fillStyle = INK; g.fill();
    g.strokeStyle = SKIN; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -M * .6); g.lineTo(0, -M * .84); g.stroke();
    g.restore();
  }
  g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, M * .48, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, M * .42, 0, TAU); g.stroke();
  for (i = 0; i < 8; i++) {
    g.save(); g.rotate(i * TAU / 8 + TAU / 16);
    petal(M * .14, M * .4, 14); g.fillStyle = INK; g.fill();
    g.restore();
  }
  g.fillStyle = SKIN; dot(g, 0, 0, M * .2);
  g.fillStyle = RED; dot(g, 0, 0, M * .12);
  g.restore();
  /* ginocchio: fascia piena con denti */
  g.fillStyle = INK; g.strokeStyle = INK;
  g.lineWidth = 3; g.beginPath(); g.moveTo(-L, 476); g.lineTo(2 * L, 476); g.stroke();
  g.fillRect(-L, 486, 3 * L, 20);
  var n = 12, s = L / n;
  for (i = 0; i < n; i++) { g.beginPath(); g.moveTo(i * s, 506); g.lineTo(i * s + s, 506); g.lineTo(i * s + s / 2, 540); g.closePath(); g.fill(); }
  /* polpaccio: anello di triangoli alternati */
  n = 16; s = L / n;
  for (i = 0; i < n; i++) {
    g.beginPath();
    if (i % 2) { g.moveTo(i * s, 640); g.lineTo(i * s + s, 640); g.lineTo(i * s + s / 2, 670); }
    else { g.moveTo(i * s, 670); g.lineTo(i * s + s, 670); g.lineTo(i * s + s / 2, 640); }
    g.closePath(); g.fill();
  }
  g.lineWidth = 2.5;
  [632, 678].forEach(function (yy) { g.beginPath(); g.moveTo(-L, yy); g.lineTo(2 * L, yy); g.stroke(); });
  for (i = 0; i < 1400; i++) {
    x = rnd() * L; y = 684 + rnd() * 150;
    if (rnd() < Math.pow(1 - (y - 684) / 150, 2)) dot(g, x, y, .9 + rnd() * 1.2);
  }
  /* catena di rombi davanti */
  for (y = 720, i = 0; y < 900; y += 46, i++) {
    g.beginPath(); g.moveTo(L / 2, y - 18); g.lineTo(L / 2 + 13, y); g.lineTo(L / 2, y + 18); g.lineTo(L / 2 - 13, y); g.closePath();
    if (i % 2) { g.lineWidth = 2.5; g.stroke(); } else g.fill();
    dot(g, L / 2, y + 23, 2.4);
  }
  /* caviglia */
  g.lineWidth = 3;
  [946, 966].forEach(function (yy) { g.beginPath(); g.moveTo(-L, yy); g.lineTo(2 * L, yy); g.stroke(); });
  for (i = 0; i < 24; i++) dot(g, (i + .5) * L / 24, 956, 2.2);
}

/* collo: girocollo di triangoli, luna e rombo sulla gola, simbolo dietro
   (la parte che si vede va più o meno da y 90 a y 340) */
function neckWork(g, L, H) {
  var i, n = 14, s = L / n;
  g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-L, 268); g.lineTo(2 * L, 268); g.stroke();
  g.fillRect(-L, 276, 3 * L, 12);
  for (i = 0; i < n; i++) {
    g.beginPath(); g.moveTo(i * s + 6, 288); g.lineTo(i * s + s - 6, 288); g.lineTo(i * s + s / 2, 330); g.closePath(); g.fill();
    dot(g, i * s + s / 2, 342, 4);
  }
  /* davanti: luna sopra, rombo grande con cuore rosso, gocce di puntini */
  var x = L / 2;
  g.beginPath(); g.moveTo(x, 150); g.lineTo(x + 40, 200); g.lineTo(x, 250); g.lineTo(x - 40, 200); g.closePath(); g.fill();
  g.fillStyle = SKIN; g.beginPath(); g.moveTo(x, 170); g.lineTo(x + 20, 200); g.lineTo(x, 230); g.lineTo(x - 20, 200); g.closePath(); g.fill();
  g.fillStyle = RED; dot(g, x, 200, 8);
  g.fillStyle = INK; dot(g, x, 112, 30);
  g.fillStyle = SKIN; dot(g, x, 100, 27);
  [-1, 1].forEach(function (d) {
    g.fillStyle = INK;
    for (var k = 0; k < 6; k++) dot(g, x + d * (64 + k * 26), 150 + k * 18, 5 - k * .5);
    g.save(); g.translate(x + d * 92, 214); g.rotate(d * .5);
    g.beginPath(); g.moveTo(0, -26); g.lineTo(14, 0); g.lineTo(0, 26); g.lineTo(-14, 0); g.closePath(); g.lineWidth = 4; g.stroke();
    g.restore();
  });
  /* dietro: triangolo nel cerchio */
  around(L, 0, function (bx) {
    g.lineWidth = 5; g.beginPath(); g.arc(bx, 190, 46, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(bx, 152); g.lineTo(bx + 33, 210); g.lineTo(bx - 33, 210); g.closePath(); g.stroke();
    dot(g, bx, 190, 7);
  });
}

/* ======================================================
   LA FIGURA: forme morbide fatte ruotando un profilo attorno all'asse
   ====================================================== */
var skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: .62, metalness: 0 });
function inked(map) { return new THREE.MeshStandardMaterial({ color: 0xffffff, map: map, roughness: .6, metalness: 0 }); }
var shortsMat = new THREE.MeshStandardMaterial({ color: '#232224', roughness: .85, side: THREE.DoubleSide });

function lathe(pts, mat, segs) {
  var curve = new THREE.SplineCurve(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
  var prof = curve.getPoints(segs || 64).map(function (v) { return new THREE.Vector2(Math.max(0, v.x), v.y); });
  return new THREE.Mesh(new THREE.LatheGeometry(prof, 64, Math.PI), mat);   // giunzione dietro
}
function blob(r, sx, sy, sz, mat) { var m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat); m.scale.set(sx, sy, sz); return m; }

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(25, 0.8, .1, 50);
camera.position.set(0, .98, 4.5);
camera.lookAt(0, .9, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc4b8, .78));
var key = new THREE.DirectionalLight(0xffffff, .78); key.position.set(2.5, 4, 5); scene.add(key);
var rim = new THREE.DirectionalLight(0xfff0e4, .55); rim.position.set(-4, 2.5, -3.5); scene.add(rim);
scene.add(new THREE.AmbientLight(0xffffff, .12));

var pivot = new THREE.Group(); pivot.position.y = .9; scene.add(pivot);
var fig = new THREE.Group(); fig.position.y = -.9; pivot.add(fig);

/* busto (schiacciato davanti-dietro) */
var torso = lathe([[0, .8], [.11, .83], [.148, .9], [.146, .98], [.138, 1.08], [.158, 1.2], [.183, 1.31], [.194, 1.37], [.15, 1.44], [.06, 1.48], [0, 1.492]], skin);
torso.scale.z = .64; fig.add(torso);
var shorts = lathe([[.118, .795], [.154, .9], [.152, .975], [.145, 1.02]], shortsMat, 24);
shorts.scale.z = .66; fig.add(shorts);

/* collo tatuato e testa */
var neck = lathe([[.062, 0], [.056, .05], [.052, .12], [.05, .2]], inked(tattoo(512, 512, .2, .3, neckWork)), 24);
neck.position.y = 1.4; fig.add(neck);
var head = blob(.1, .88, 1.17, .98, skin); head.position.y = 1.69; fig.add(head);

/* braccia: quello a sinistra di chi guarda è tatuato */
var armPts = [[.027, 0], [.032, .06], [.043, .17], [.038, .29], [.048, .4], [.054, .5], [.056, .57], [.042, .62], [0, .645]];
var sleeveMap = tattoo(512, 1024, .645, .264, sleeve);
[-1, 1].forEach(function (side) {
  var sh = new THREE.Group(); sh.position.set(side * .216, 1.385, 0); sh.rotation.z = side * .15; fig.add(sh);
  var arm = lathe(armPts, side < 0 ? inked(sleeveMap) : skin); arm.position.y = -.62; sh.add(arm);
  var hand = blob(.044, .62, 1.45, .9, skin); hand.position.y = -.665; sh.add(hand);
  var joint = blob(.062, 1, 1, 1, skin); joint.position.y = -.02; sh.add(joint);
});

/* gambe: quella a destra di chi guarda è tatuata */
var legPts = [[.035, 0], [.042, .06], [.055, .2], [.058, .27], [.047, .4], [.052, .47], [.072, .62], [.08, .74], [.082, .86]];
var legMap = tattoo(512, 1024, .86, .365, legWork);
[-1, 1].forEach(function (side) {
  var leg = lathe(legPts, side > 0 ? inked(legMap) : skin); leg.position.set(side * .088, .06, 0); fig.add(leg);
  var foot = blob(.07, .55, .45, 1.3, skin); foot.position.set(side * .088, .035, .04); fig.add(foot);
  var cuff = lathe([[.093, .76], [.091, .84], [.098, .92]], shortsMat, 12); cuff.position.x = side * .088; fig.add(cuff);
});

/* ombra morbida a terra (non gira con la figura) */
var sc = document.createElement('canvas'); sc.width = sc.height = 128;
var sg = sc.getContext('2d'), grd = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
grd.addColorStop(0, 'rgba(0,0,0,.28)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
var shadow = new THREE.Mesh(new THREE.PlaneGeometry(.95, .95), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = .001; shadow.scale.y = .55; scene.add(shadow);

/* ======================================================
   MOVIMENTO
   ====================================================== */
var BASE = reduce ? 0 : .45;          // giri da sola: radianti al secondo
var angle = -.55, speed = BASE, target = BASE, tilt = 0, tiltT = 0, dir = 1;
var dragging = false, lastX = 0, lastT = 0, dragV = 0;

function size() {
  var w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  draw();
}
function draw() { pivot.rotation.y = angle; pivot.rotation.x = tilt; renderer.render(scene, camera); }

/* mouse: la posizione sulla figura decide verso e velocità */
cv.addEventListener('pointermove', function (e) {
  if (e.pointerType === 'mouse') {
    var r = cv.getBoundingClientRect();
    var mx = (e.clientX - r.left) / r.width * 2 - 1, my = (e.clientY - r.top) / r.height * 2 - 1;
    target = Math.abs(mx) < .08 ? 0 : mx * 3;
    tiltT = my * .2;
  } else if (dragging) {
    var now = performance.now(), dx = e.clientX - lastX;
    angle += dx * .012;
    dragV = dx * .012 / Math.max(.008, (now - lastT) / 1000);
    lastX = e.clientX; lastT = now;
  }
});
cv.addEventListener('pointerleave', function (e) {
  if (e.pointerType !== 'mouse') return;
  if (target) dir = target > 0 ? 1 : -1;          // riparte nel verso scelto
  target = BASE * dir; tiltT = 0;
});
/* dito: si trascina in orizzontale, in verticale la pagina scorre */
cv.addEventListener('pointerdown', function (e) {
  if (e.pointerType === 'mouse') return;
  dragging = true; lastX = e.clientX; lastT = performance.now(); dragV = 0; speed = 0;
});
function endDrag() {
  if (!dragging) return;
  dragging = false;
  if (dragV) dir = dragV > 0 ? 1 : -1;
  speed = Math.max(-4, Math.min(4, dragV)); target = BASE * dir;
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

var last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  var dt = Math.min(.05, (now - last) / 1000); last = now;
  /* ferma quando la pagina non si vede o quando la figura è fuori dallo schermo */
  if (document.hidden) return;
  var vr = box.getBoundingClientRect();
  if (vr.bottom < 0 || vr.top > window.innerHeight) return;     // fuori schermo: pausa
  var ease = Math.min(1, dt * 4);
  if (!dragging) { speed += (target - speed) * ease; angle += speed * dt; }
  tilt += (tiltT - tilt) * Math.min(1, dt * 5);
  draw();
}

if (window.ResizeObserver) new ResizeObserver(size).observe(cv); else window.addEventListener('resize', size);
size();
requestAnimationFrame(frame);
})();
