#!/usr/bin/env python3
"""Genera i lavori di portfolio.html e la selezione della home (index.html)
partendo da data/lavori.json, il file che il cliente modifica con Pages CMS.

Uso:  python3 scripts/genera_lavori.py           (scrive i file)
      python3 scripts/genera_lavori.py --check   (esce con errore se i file non sono aggiornati)

Tocca solo il testo fra i segnaposto <!-- lavori:inizio --> e <!-- lavori:fine -->.
"""
import html, json, os, sys

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STILI = [  # ordine dei filtri e della home; il nome deve combaciare con .pages.yml
    ("blackwork", "Blackwork"), ("dotwork", "Dotwork"), ("fine-line", "Fine line"),
    ("tradizionale", "Tradizionale"), ("giapponese", "Giapponese"), ("realistico", "Realistico"),
]
NOMI = dict(STILI)
INIZIO, FINE = "<!-- lavori:inizio -->", "<!-- lavori:fine -->"

def att(t): return html.escape(t, quote=True)
def txt(t): return html.escape(t, quote=False)

def carica():
    with open(os.path.join(RADICE, "data", "lavori.json"), encoding="utf-8") as f:
        dati = json.load(f)
    lavori = []
    for n, l in enumerate(dati, 1):
        foto = str(l.get("foto") or "").strip().lstrip("/")
        titolo = str(l.get("titolo") or "").strip()
        stile = str(l.get("stile") or "").strip()
        zona = str(l.get("zona") or "").strip()
        if not foto or not titolo or stile not in NOMI:
            print(f"avviso: lavoro n. {n} saltato (manca la foto o il titolo, o lo stile non è valido)", file=sys.stderr)
            continue
        if not os.path.exists(os.path.join(RADICE, foto)):
            print(f"avviso: lavoro n. {n} saltato, la foto {foto} non esiste", file=sys.stderr)
            continue
        lavori.append(dict(foto=foto, titolo=titolo, stile=stile, zona=zona, nome=NOMI[stile],
                           alt=f"{titolo}, tatuaggio {NOMI[stile].lower()}"))
    return lavori

def portfolio(lavori):
    righe = []
    for l in lavori:
        sotto = l["nome"] + (" · " + l["zona"] if l["zona"] else "")
        righe.append(
            f'                    <figure class="work rv" data-cat="{l["stile"]}"><button type="button" aria-label="Apri {att(l["titolo"])} a schermo intero">'
            f'<span class="ph"><img src="{att(l["foto"])}" alt="{att(l["alt"])}" width="800" height="1000" loading="lazy"></span></button>'
            f'<figcaption><b>{txt(l["titolo"])}</b><span>{txt(sotto)}</span></figcaption></figure>')
    return righe

def home(lavori):
    # per ogni stile, il primo lavoro dell'elenco (quello più in alto nel pannello)
    scelti = [next(l for l in lavori if l["stile"] == s) for s, _ in STILI if any(l["stile"] == s for l in lavori)]
    return [
        f'                    <a class="hp-work rv rv-pop" href="portfolio.html#{l["stile"]}" style="--rv-d:{(i % 3) * 0.08:.2f}s">'
        f'<span class="ph"><img src="{att(l["foto"])}" alt="{att(l["alt"])}" width="800" height="1000" loading="lazy"></span>'
        f'<span class="cap"><b>{txt(l["titolo"])}</b><span>{l["nome"]}</span></span></a>'
        for i, l in enumerate(scelti)]

def sostituisci(nome, righe, controlla):
    percorso = os.path.join(RADICE, nome)
    with open(percorso, encoding="utf-8") as f:
        s = f.read()
    a, b = s.index(INIZIO) + len(INIZIO), s.index(FINE)
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
    ok = sostituisci("portfolio.html", portfolio(lavori), controlla) & sostituisci("index.html", home(lavori), controlla)
    sys.exit(0 if ok else 1)
