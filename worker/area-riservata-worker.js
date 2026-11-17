/**
 * Rain Ink Tattoo — servizio dell'area riservata (Cloudflare Worker).
 *
 * Fa da ponte fra la pagina area-riservata.html e il repository GitHub del sito:
 * controlla la password, poi legge e salva data/lavori.json e le foto in images/lavori/
 * con un solo commit per ogni salvataggio. GitHub Actions ripubblica il sito da solo.
 *
 * Impostazioni del Worker (Cloudflare → Workers → questo Worker → Settings → Variables):
 *   Secret  ADMIN_PASSWORD   password dell'area riservata (scelta col cliente)
 *   Secret  SESSION_SECRET   stringa casuale lunga, serve a firmare l'accesso
 *   Secret  GITHUB_TOKEN     token "fine-grained" solo per il repository inkubo,
 *                            permesso Contents: Read and write
 *   Text    REPO             nemesiMark/inkubo
 *   Text    BRANCH           main
 *   Text    ORIGINS          https://nemesimark.github.io  (più indirizzi separati da virgola)
 * Nessuna chiave è scritta in questo file.
 */

const STILI = ["blackwork", "fine-line", "dotwork", "tradizionale", "giapponese", "realistico"];
const FILE_LAVORI = "data/lavori.json";
const CARTELLA_FOTO = "images/lavori/";
const MAX_FOTO_BYTES = 4 * 1024 * 1024;   // dopo il ridimensionamento nel browser sono ~0,3–0,6 MB
const MAX_FOTO_PER_SALVATAGGIO = 12;
const MAX_LAVORI = 300;
const DURATA_ACCESSO_S = 30 * 24 * 3600;  // 30 giorni
const FOTO_VALIDA = /^images\/(lavori|flash)\/[a-z0-9][a-z0-9._-]{0,120}\.(jpe?g|png|webp|svg)$/;

export default {
  async fetch(request, env) {
    const cors = intestazioniCors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/login") return await login(request, env, cors);
      if (!(await accessoValido(request, env))) return json({ errore: "Accesso scaduto, entra di nuovo" }, 401, cors);
      if (request.method === "GET" && url.pathname === "/lavori") return await leggiLavori(env, cors);
      if (request.method === "POST" && url.pathname === "/salva") return await salva(request, env, cors);
      return json({ errore: "Indirizzo non valido" }, 404, cors);
    } catch (e) {
      const stato = e && e.stato ? e.stato : 500;
      return json({ errore: e && e.utente ? e.message : "Errore del servizio, riprova tra poco" }, stato, cors);
    }
  },
};

/* ---------- accesso ---------- */

async function login(request, env, cors) {
  const corpo = await request.json().catch(() => ({}));
  const ok = typeof corpo.password === "string" && (await ugualiCostante(corpo.password, env.ADMIN_PASSWORD || ""));
  if (!ok || !env.ADMIN_PASSWORD) {
    await new Promise((r) => setTimeout(r, 1200)); // rallenta i tentativi a raffica
    return json({ errore: "Password non corretta" }, 401, cors);
  }
  const scade = Math.floor(Date.now() / 1000) + DURATA_ACCESSO_S;
  const dati = b64url(new TextEncoder().encode(JSON.stringify({ scade })));
  return json({ token: dati + "." + (await firma(dati, env)), scade }, 200, cors);
}

async function accessoValido(request, env) {
  const h = request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [dati, sig] = token.split(".");
  if (!dati || !sig || !env.SESSION_SECRET) return false;
  if (!(await ugualiCostante(sig, await firma(dati, env)))) return false;
  try {
    const { scade } = JSON.parse(new TextDecoder().decode(daB64url(dati)));
    return typeof scade === "number" && scade > Date.now() / 1000;
  } catch { return false; }
}

async function firma(testo, env) {
  const chiave = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", chiave, new TextEncoder().encode(testo))));
}

// confronto a tempo costante: si confrontano le impronte SHA-256, sempre della stessa lunghezza
async function ugualiCostante(a, b) {
  const [x, y] = await Promise.all([a, b].map(async (s) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ---------- lettura ---------- */

async function leggiLavori(env, cors) {
  const { lavori } = await statoAttuale(env);
  return json({ lavori }, 200, cors);
}

async function statoAttuale(env) {
  const ref = await gh(env, `git/ref/heads/${env.BRANCH}`);
  const sha = ref.object.sha;
  const file = await gh(env, `contents/${FILE_LAVORI}?ref=${sha}`);
  const testo = new TextDecoder().decode(daB64(file.content.replace(/\n/g, "")));
  const lavori = JSON.parse(testo);
  return { sha, lavori: Array.isArray(lavori) ? lavori : [] };
}

/* ---------- salvataggio ---------- */

/**
 * Corpo: { lavori: [ {foto, titolo, stile, zona} ], nuoveFoto: { "nuova:ID": "base64…" }, messaggio }
 * Nel campo foto di un lavoro nuovo c'è "nuova:ID": qui diventa il percorso vero della foto caricata.
 * Le foto di images/lavori/ che non compaiono più nell'elenco vengono cancellate.
 */
async function salva(request, env, cors) {
  const corpo = await request.json().catch(() => null);
  if (!corpo || !Array.isArray(corpo.lavori)) throw errore("Dati non validi", 400);
  if (corpo.lavori.length > MAX_LAVORI) throw errore("Troppi lavori", 400);
  const nuove = corpo.nuoveFoto && typeof corpo.nuoveFoto === "object" ? corpo.nuoveFoto : {};
  if (Object.keys(nuove).length > MAX_FOTO_PER_SALVATAGGIO) throw errore("Troppe foto in una volta", 400);

  // foto nuove: controllo e nome definitivo
  const blobFoto = [];
  const percorsi = {};
  for (const [id, b64] of Object.entries(nuove)) {
    if (!/^nuova:[a-z0-9]{6,32}$/.test(id) || typeof b64 !== "string") throw errore("Foto non valida", 400);
    const byte = daB64(b64);
    if (byte.length > MAX_FOTO_BYTES) throw errore("Foto troppo grande", 413);
    const est = tipoImmagine(byte);
    if (!est) throw errore("Formato della foto non supportato", 415);
    percorsi[id] = null;
    blobFoto.push({ id, b64, est });
  }

  // elenco: ogni campo controllato, testi ripuliti
  const lavori = corpo.lavori.map((l, i) => {
    const titolo = pulisci(l && l.titolo, 80);
    const zona = pulisci(l && l.zona, 60);
    const stile = l && l.stile;
    let foto = String((l && l.foto) || "");
    if (!titolo) throw errore(`Manca il titolo del lavoro n. ${i + 1}`, 400);
    if (!STILI.includes(stile)) throw errore(`Stile non valido nel lavoro n. ${i + 1}`, 400);
    if (!(foto in percorsi) && !FOTO_VALIDA.test(foto)) throw errore(`Foto non valida nel lavoro n. ${i + 1}`, 400);
    return { foto, titolo, stile, zona };
  });

  const giorno = new Date().toISOString().slice(0, 10);
  for (const f of blobFoto) {
    const lavoro = lavori.find((l) => l.foto === f.id);
    if (!lavoro) continue; // foto caricata ma non usata: si ignora
    const nome = `${giorno}-${slug(lavoro.titolo)}-${casuale(6)}.${f.est}`;
    percorsi[f.id] = CARTELLA_FOTO + nome;
    lavoro.foto = percorsi[f.id];
  }

  // fino a 3 tentativi se nel frattempo il ramo è cambiato
  for (let tentativo = 0; tentativo < 3; tentativo++) {
    const { sha, lavori: prima } = await statoAttuale(env);
    const usate = new Set(lavori.map((l) => l.foto));
    const daCancellare = [...new Set(prima.map((l) => l && l.foto).filter((p) =>
      typeof p === "string" && p.startsWith(CARTELLA_FOTO) && FOTO_VALIDA.test(p) && !usate.has(p)))];

    const commit = await gh(env, `git/commits/${sha}`);
    const albero = [];
    for (const f of blobFoto) {
      if (!percorsi[f.id]) continue;
      const blob = await gh(env, "git/blobs", "POST", { content: f.b64, encoding: "base64" });
      albero.push({ path: percorsi[f.id], mode: "100644", type: "blob", sha: blob.sha });
    }
    albero.push({ path: FILE_LAVORI, mode: "100644", type: "blob", content: JSON.stringify(lavori, null, 2) + "\n" });
    for (const p of daCancellare) albero.push({ path: p, mode: "100644", type: "blob", sha: null });

    const nuovoAlbero = await gh(env, "git/trees", "POST", { base_tree: commit.tree.sha, tree: albero });
    const messaggio = pulisci(corpo.messaggio, 100) || "Area riservata: aggiornati i lavori del portfolio";
    const nuovoCommit = await gh(env, "git/commits", "POST", { message: messaggio, tree: nuovoAlbero.sha, parents: [sha] });
    try {
      await gh(env, `git/refs/heads/${env.BRANCH}`, "PATCH", { sha: nuovoCommit.sha, force: false });
      return json({ lavori, commit: nuovoCommit.sha }, 200, cors);
    } catch (e) {
      if (e.stato !== 422) throw e; // 422: il ramo è andato avanti, si riprova sul nuovo stato
    }
  }
  throw errore("Il sito è stato modificato nello stesso momento, riprova", 409);
}

/* ---------- GitHub ---------- */

async function gh(env, percorso, metodo = "GET", corpo) {
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/${percorso}`, {
    method: metodo,
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "rainink-area-riservata",
      ...(corpo ? { "Content-Type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.stato = r.status; throw e; }
  return r.json();
}

/* ---------- utilità ---------- */

function intestazioniCors(request, env) {
  const ammessi = String(env.ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origine = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ammessi.includes(origine) ? origine : (ammessi[0] || "null"),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(dati, stato, cors) {
  return new Response(JSON.stringify(dati), { status: stato, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

function errore(messaggio, stato) { const e = new Error(messaggio); e.stato = stato; e.utente = true; return e; }

function pulisci(v, max) {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function slug(t) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "lavoro";
}

function casuale(n) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789", b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join("");
}

function tipoImmagine(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

function daB64(s) { const t = atob(s); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
function b64url(u) { let t = ""; for (const x of u) t += String.fromCharCode(x); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function daB64url(s) { return daB64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); }
