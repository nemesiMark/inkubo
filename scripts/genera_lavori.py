#!/usr/bin/env python3
"""Genera i lavori di portfolio.html (da data/lavori.json: foto e video divisi in gruppi
con data-cat: tatuaggi a colori, bianco e nero, video, dallo studio), la ruota 3D della home in index.html (da data/ruota.json, un elenco a sé),
la sezione Video della home (data/video.json), le foto della sezione Lo studio della home (data/studio-home.json) e le altre immagini delle pagine
(data/immagini.json: ogni <img data-slot="…"> prende foto e testo alternativo) e i testi delle pagine
(data/testi.json: ogni elemento data-testo="…" prende il suo testo; **grassetto**, ==evidenziato==, `codice`, [testo](link)).
Sono i file che il cliente modifica dall'area riservata.

I video NON stanno nel repository: sono allegati alla release «video» di GitHub e la
pubblicazione (.github/workflows/pubblica.yml) li scarica in video/ prima di eseguire questo
script. Nei file data/*.json il campo «video» è il percorso sul sito (video/nome.mp4) e
«foto» è la sua copertina (un normale JPEG in images/lavori/).

Uso:  python3 scripts/genera_lavori.py           (scrive i file)
      python3 scripts/genera_lavori.py --check   (esce con errore se i file non sono aggiornati)

Tocca solo il testo fra i segnaposto <!-- lavori:inizio --> / <!-- lavori:fine --> e
<!-- video:inizio --> / <!-- video:fine -->.
"""
import html, json, os, re, sys

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INIZIO, FINE = "<!-- lavori:inizio -->", "<!-- lavori:fine -->"
VIDEO_VALIDO = re.compile(r"^video/[a-z0-9][a-z0-9._-]{0,120}\.(mp4|webm)$")
# gruppi del portfolio (i pulsanti in cima a portfolio.html): le foto hanno «tipo», i video sono sempre «video».
# Stessi valori in area-riservata.html e nel Worker.
TIPI_FOTO = ("colori", "bn", "studio")

def att(t): return html.escape(t, quote=True)
def txt(t): return html.escape(t, quote=False)

def carica(nome="lavori.json"):
    # foto e video, nell'ordine scelto dal cliente
    with open(os.path.join(RADICE, "data", nome), encoding="utf-8") as f:
        dati = json.load(f)
    voci = []
    for n, l in enumerate(dati, 1):
        foto = str(l.get("foto") or "").strip().lstrip("/")
        titolo = str(l.get("titolo") or "").strip()
        video = str(l.get("video") or "").strip().lstrip("/")
        if not foto or not titolo:
            print(f"avviso: {nome} n. {n} saltato (manca la foto o il titolo)", file=sys.stderr)
            continue
        if not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: {nome} n. {n} saltato, la foto {foto} non esiste", file=sys.stderr)
            continue
        if video and not VIDEO_VALIDO.match(video):
            print(f"avviso: {nome} n. {n} saltato, video non valido: {video}", file=sys.stderr)
            continue
        if video and not os.path.exists(os.path.join(RADICE, video)):
            # in locale di solito i video mancano: li scarica la pubblicazione
            print(f"nota: {video} non è in questa cartella (lo scarica la pubblicazione)", file=sys.stderr)
        tipo = "video" if video else str(l.get("tipo") or "").strip()
        if tipo not in TIPI_FOTO and tipo != "video":
            tipo = "colori"  # foto senza gruppo: va fra i tatuaggi a colori
        voci.append(dict(foto=foto, titolo=titolo, video=video, tipo=tipo, alt=f"{titolo}, Rain Ink Tattoo"))
    return voci

def portfolio(lavori):
    righe = []
    for l in lavori:
        if l["video"]:
            righe.append(
                f'                    <figure class="work rv is-video" data-cat="video" data-video="{att(l["video"])}"><button type="button" aria-label="Guarda il video {att(l["titolo"])}">'
                f'<span class="ph"><img src="{att(l["foto"])}" alt="{att(l["alt"])}" width="800" height="1000" loading="lazy"><span class="play" aria-hidden="true"></span></span></button>'
                f'<figcaption><b>{txt(l["titolo"])}</b><span>Video</span></figcaption></figure>')
        else:
            righe.append(
                f'                    <figure class="work rv" data-cat="{l["tipo"]}"><button type="button" aria-label="Apri {att(l["titolo"])} a schermo intero">'
                f'<span class="ph"><img src="{att(l["foto"])}" alt="{att(l["alt"])}" width="800" height="1000" loading="lazy"></span></button>'
                f'<figcaption><b>{txt(l["titolo"])}</b></figcaption></figure>')
    return righe

def video_home(lista):
    return [
        f'                    <figure class="clip"><video src="{att(v["video"])}" poster="{att(v["foto"])}" controls playsinline preload="none"'
        f' aria-label="{att(v["titolo"])}"></video><figcaption>{txt(v["titolo"])}</figcaption></figure>'
        for v in lista if v["video"]]

def studio_home(foto):
    # sezione «Lo studio» della home: data/studio-home.json (elenco a sé, indipendente dal gruppo
    # «Dallo studio» del Portfolio) in due colonne che scorrono (una sì e una no); il giro infinito
    # lo fa js/home.js duplicandole
    colonne = []
    for k in (0, 1):
        imgs = "".join(f'<img src="{att(l["foto"])}" alt="{att(l["titolo"] + ", Rain Ink Tattoo")}" width="800" height="1000" loading="lazy">' for l in foto[k::2])
        colonne.append(f'                    <div class="sc-col{" sc-giu" if k else ""}">{imgs}</div>')
    return colonne

def carica_ruota(nome="ruota.json"):
    # ruota 3D della home (data/ruota.json) o sezione Lo studio della home (data/studio-home.json):
    # elenchi a sé, nell'ordine scelto dal cliente (solo foto e titolo)
    with open(os.path.join(RADICE, "data", nome), encoding="utf-8") as f:
        dati = json.load(f)
    ruota = []
    for n, r in enumerate(dati, 1):
        foto = str(r.get("foto") or "").strip().lstrip("/")
        titolo = str(r.get("titolo") or "").strip()
        if not foto or not titolo or not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: foto n. {n} di {nome} saltata (manca la foto o il titolo)", file=sys.stderr)
            continue
        ruota.append(dict(foto=foto, titolo=titolo))
    return ruota

def home(ruota):
    return [
        f'                        <figure class="face" data-name="{att(r["titolo"])}" data-title="">'
        f'<img src="{att(r["foto"])}" alt="{att(r["titolo"] + ", tatuaggio di Rain Ink")}" width="800" height="1000" draggable="false"></figure>'
        for r in ruota]

def immagini(controlla):
    # ogni voce di data/immagini.json aggiorna src e alt dell'<img data-slot="id"> nella sua pagina
    percorso = os.path.join(RADICE, "data", "immagini.json")
    if not os.path.exists(percorso):
        return True
    with open(percorso, encoding="utf-8") as f:
        voci = json.load(f)
    pagine, ok = {}, True
    for v in voci:
        foto = str(v.get("foto") or "").strip().lstrip("/")
        if not foto or not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: immagine {v.get('id')} saltata, la foto {foto} non esiste", file=sys.stderr)
            continue
        nome = v["pagina"]
        if nome not in pagine:
            with open(os.path.join(RADICE, nome), encoding="utf-8") as f:
                pagine[nome] = [f.read(), None]
            pagine[nome][1] = pagine[nome][0]
        s = pagine[nome][0]
        segno = f'<img data-slot="{v["id"]}" '
        a = s.find(segno)
        if a < 0:
            print(f"avviso: in {nome} manca l'immagine {v['id']}", file=sys.stderr)
            continue
        b = s.index(">", a)
        tag = s[a:b]
        tag = re.sub(r' src="[^"]*"', f' src="{att(foto)}"', tag, count=1)
        tag = re.sub(r' alt="[^"]*"', f' alt="{att(str(v.get("alt") or "").strip())}"', tag, count=1)
        pagine[nome][0] = s[:a] + tag + s[b:]
    for nome, (nuovo, prima) in pagine.items():
        if nuovo == prima:
            continue
        if controlla:
            print(f"{nome} non è aggiornato: esegui python3 scripts/genera_lavori.py", file=sys.stderr)
            ok = False
            continue
        with open(os.path.join(RADICE, nome), "w", encoding="utf-8") as f:
            f.write(nuovo)
        print(f"{nome} aggiornato (immagini)")
    return ok

LINK_VALIDO = re.compile(r"^(https?://[^\s<>\"']+|mailto:[^\s<>\"']+|tel:\+?[0-9 ()./-]+|#[A-Za-z0-9_-]*|(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._/-]*(#[A-Za-z0-9_-]*)?)$")
MARCHE = re.compile(r"\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|==(.+?)==|`(.+?)`", re.S)


def link_ok(u): return bool(LINK_VALIDO.match(u or ""))


def attributi_link(u):
    if u.startswith(("mailto:", "tel:", "#")):
        return ""
    # i link alle pagine del sito si aprono nella stessa scheda, quelli esterni in una nuova
    return ' target="_blank" rel="noopener noreferrer"' if u.startswith("http") else ""


def html_testo(t, link_ammessi=True):
    """testo con le regole (**grassetto**, [testo](link), a capo…) → HTML sicuro"""
    out, i = [], 0
    for m in MARCHE.finditer(t):
        out.append(txt(t[i:m.start()]).replace("\n", "<br>"))
        testo_link, url, gr, ev, cod = m.groups()
        if testo_link is not None:
            dentro = html_testo(testo_link, False)
            out.append(f'<a href="{att(url)}"{attributi_link(url)}>{dentro}</a>' if link_ammessi and link_ok(url) else txt(m.group(0)))
        elif gr is not None:
            out.append(f"<strong>{html_testo(gr, link_ammessi)}</strong>")
        elif ev is not None:
            out.append(f"<mark>{html_testo(ev, link_ammessi)}</mark>")
        else:
            out.append(f"<code>{txt(cod)}</code>")
        i = m.end()
    out.append(txt(t[i:]).replace("\n", "<br>"))
    return "".join(out)


VUOTI = {"br", "img", "input", "meta", "link", "hr", "source", "wbr", "path", "circle", "rect"}
ETICHETTA = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(/?)>|<!--.*?-->", re.S)


def elemento(s, vid):
    """posizioni di <tag data-testo="vid" …>contenuto</tag>: (inizio, inizio contenuto, fine contenuto, nome)"""
    k = s.find(f' data-testo="{vid}"')
    if k < 0:
        return None
    a = s.rfind("<", 0, k)
    nome = re.match(r"<([a-zA-Z0-9]+)", s[a:]).group(1).lower()
    c = s.index(">", k) + 1
    prof = 1
    for m in ETICHETTA.finditer(s, c):
        if m.group(2) is None or m.group(2).lower() != nome or m.group(2).lower() in VUOTI or m.group(3):
            continue
        prof += -1 if m.group(1) else 1
        if prof == 0:
            return a, c, m.start(), nome
    return None


def solo_testo_diretto(contenuto, nuovo):
    """sostituisce l'unico pezzo di testo diretto (non dentro altri elementi) tenendo gli spazi attorno"""
    pezzi, prof, i = [], 0, 0
    for m in ETICHETTA.finditer(contenuto):
        if prof == 0 and contenuto[i:m.start()].strip():
            pezzi.append((i, m.start()))
        if m.group(2) and m.group(2).lower() not in VUOTI and not m.group(3):
            prof += -1 if m.group(1) else 1
        i = m.end()
    if prof == 0 and contenuto[i:].strip():
        pezzi.append((i, len(contenuto)))
    if len(pezzi) != 1:
        return None
    a, b = pezzi[0]
    vecchio = contenuto[a:b]
    prima = vecchio[:len(vecchio) - len(vecchio.lstrip())]
    dopo = vecchio[len(vecchio.rstrip()):]
    return contenuto[:a] + prima + txt(nuovo) + dopo + contenuto[b:]


def testi(controlla):
    # data/testi.json: ogni voce cambia il testo dell'elemento data-testo="id" nella sua pagina
    percorso = os.path.join(RADICE, "data", "testi.json")
    if not os.path.exists(percorso):
        return True
    with open(percorso, encoding="utf-8") as f:
        voci = json.load(f)
    pagine = {}
    for v in voci:
        nome, vid = v["pagina"], v["id"]
        t = str(v.get("testo") or "").replace("\r\n", "\n").strip()
        if not t:
            print(f"avviso: testo {vid} vuoto, lasciato com'era", file=sys.stderr)
            continue
        if nome not in pagine:
            with open(os.path.join(RADICE, nome), encoding="utf-8") as f:
                prima = f.read()
            pagine[nome] = [prima, prima]
        s = pagine[nome][0]
        pos = elemento(s, vid)
        if not pos:
            print(f"avviso: in {nome} manca il testo {vid}", file=sys.stderr)
            continue
        a, c, e, tag = pos
        if v.get("tipo") == "semplice":
            nuovo = solo_testo_diretto(s[c:e], " ".join(t.split()))
            if nuovo is None:
                print(f"avviso: testo {vid} non sostituibile", file=sys.stderr)
                continue
        else:
            nuovo = html_testo(t, tag != "a")
        apertura = s[a:c]
        if "link" in v:
            u = str(v.get("link") or "").strip()
            if link_ok(u):
                apertura = re.sub(r' href="[^"]*"', f' href="{att(u)}"', apertura, count=1)
            else:
                print(f"avviso: link non valido per {vid}: {u}", file=sys.stderr)
        pagine[nome][0] = s[:a] + apertura + nuovo + s[e:]
    ok = True
    for nome, (nuovo, prima) in pagine.items():
        if nuovo == prima:
            continue
        if controlla:
            print(f"{nome} non è aggiornato: esegui python3 scripts/genera_lavori.py", file=sys.stderr)
            ok = False
            continue
        with open(os.path.join(RADICE, nome), "w", encoding="utf-8") as f:
            f.write(nuovo)
        print(f"{nome} aggiornato (testi)")
    return ok

def sostituisci(nome, righe, controlla, segni=(INIZIO, FINE)):
    percorso = os.path.join(RADICE, nome)
    with open(percorso, encoding="utf-8") as f:
        s = f.read()
    a, b = s.index(segni[0]) + len(segni[0]), s.index(segni[1])
    rientro = s[s.rfind("\n", 0, b) + 1:b]
    nuovo = s[:a] + "\n" + "\n".join(righe) + "\n" + rientro + s[b:]
    if nuovo == s:
        return True
    if controlla:
        print(f"{nome} non è aggiornato: esegui python3 scripts/genera_lavori.py", file=sys.stderr)
        return False
    with open(percorso, "w", encoding="utf-8") as f:
        f.write(nuovo)
    print(f"{nome} aggiornato")
    return True

if __name__ == "__main__":
    controlla = "--check" in sys.argv
    lavori = carica()
    ok = sostituisci("portfolio.html", portfolio(lavori), controlla) & sostituisci("index.html", home(carica_ruota()), controlla)
    ok = sostituisci("index.html", video_home(carica("video.json")), controlla, ("<!-- video:inizio -->", "<!-- video:fine -->")) & ok
    ok = sostituisci("index.html", studio_home(carica_ruota("studio-home.json")), controlla, ("<!-- studio:inizio -->", "<!-- studio:fine -->")) & ok
    ok = immagini(controlla) & ok
    ok = testi(controlla) & ok
    sys.exit(0 if ok else 1)
