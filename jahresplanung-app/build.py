# -*- coding: utf-8 -*-
"""Baut die App zu einer einzigen, offline lauffähigen HTML-Datei (Programm + Daten)."""
import base64, glob, json, os, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'Jahresplanung_Aussenkommunikation.html')
data = json.load(open(os.path.join(HERE, 'src', 'initial_data.json'), encoding='utf8'))
tpl = next(m['plan'] for m in data['massnahmen'] if m.get('plan'))
css = open(os.path.join(HERE, 'src', 'style.css'), encoding='utf8').read()
js = '\n'.join(open(f, encoding='utf8').read() for f in sorted(glob.glob(os.path.join(HERE, 'src', '[0-9][0-9]_*.js'))))
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='13' fill='%23E30714'/%3E"
           "%3Crect x='11' y='14' width='42' height='38' rx='5' fill='white'/%3E%3Crect x='11' y='14' width='42' height='10' rx='3' fill='%23404040'/%3E"
           "%3Cg fill='%23E30714'%3E%3Crect x='17' y='30' width='8' height='7' rx='1'/%3E%3Crect x='28' y='30' width='8' height='7' rx='1'/%3E"
           "%3Crect x='39' y='30' width='8' height='7' rx='1'/%3E%3Crect x='17' y='40' width='8' height='7' rx='1'/%3E%3Crect x='28' y='40' width='8' height='7' rx='1'/%3E%3C/g%3E%3C/svg%3E")
# Versionsnummer und Änderungsliste (neueste zuerst); ohne Datum gilt die Bauzeit
CHANGELOG = json.load(open(os.path.join(HERE, 'src', 'changelog.json'), encoding='utf8'))
if not CHANGELOG[0].get('date'):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    CHANGELOG[0]['date'] = datetime.now(ZoneInfo('Europe/Berlin')).strftime('%Y-%m-%dT%H:%M')
APP_INFO = {'version': CHANGELOG[0]['version'], 'date': CHANGELOG[0]['date']}
# Startanimation (Lottie) in Malteser-Farben umfärben: Dunkelblau → Dunkelrot, Hellblau → Malteser-Rot
def recolor(o, pairs):
    if isinstance(o, dict):
        c = o.get('c')
        if isinstance(c, dict) and not c.get('a') and isinstance(c.get('k'), list) and len(c['k']) == 4:
            for src, dst in pairs:
                if all(abs(x - y) < 0.01 for x, y in zip(c['k'][:3], src)):
                    c['k'] = dst + [c['k'][3]]
        for v in o.values(): recolor(v, pairs)
    elif isinstance(o, list):
        for v in o: recolor(v, pairs)
    return o
hexf = lambda h: [round(int(h[i:i + 2], 16) / 255, 4) for i in (1, 3, 5)]
SPLASH = recolor(json.load(open(os.path.join(HERE, 'src', 'splash_original.json'), encoding='utf8')),
                 [([0.0706, 0.5333, 0.7725], hexf('#A5000F')), ([0.2392, 0.7404, 1.0], hexf('#E30714'))])
LOGO = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(HERE, 'src', 'logo.png'), 'rb').read()).decode()
# weißes Logo (aus der Malteser-Vorlage „Logo_malteser_einfarbig_weiss.pdf“) für das dunkle Design
LOGO_DARK = 'data:image/svg+xml;base64,' + base64.b64encode(open(os.path.join(HERE, 'src', 'logo_weiss.svg'), 'rb').read()).decode()
js = js.replace("'use strict';", "'use strict';\nconst LOGO = " + json.dumps(LOGO) + ";\nconst LOGO_DARK = " + json.dumps(LOGO_DARK) + ";\nconst MAILING_TEMPLATE = " + json.dumps(tpl, ensure_ascii=False) + ";\nconst FAVICON = " + json.dumps(FAVICON) + ";\nconst APP_INFO = " + json.dumps(APP_INFO) + ";\nconst CHANGELOG = " + json.dumps(CHANGELOG, ensure_ascii=False) + ";\nconst SPLASH_ANIM = " + json.dumps(SPLASH, separators=(',', ':')) + ";", 1)
for bad in ('</script', '<!--'):
    assert bad not in js.lower(), bad
dj = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
html = ('<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<title>Jahresplanung Außenkommunikation</title>\n<link rel="icon" href="' + FAVICON + '">\n<style id="jp-style">' + css + '</style>\n</head>\n<body>\n<div id="app"></div>\n'
        '<script type="application/json" id="jp-data">' + dj + '</script>\n<script id="jp-app">' + js + '</script>\n</body>\n</html>\n')
open(OUT, 'w', encoding='utf8').write(html)
print('OK', OUT, len(html) // 1024, 'KB')

# Paket für den Mailing-Ordner: Startknopf + Programmdatei (die Excel-Ansicht entsteht beim ersten Speichern)
ZIP = os.path.join(HERE, 'Jahresplanung_fuer_Mailing-Ordner.zip')
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(HERE, 'launcher', 'Jahresplanung starten.cmd'), 'Jahresplanung starten.cmd')
    z.write(OUT, os.path.basename(OUT))
print('OK', ZIP)
