# -*- coding: utf-8 -*-
"""Baut die Bedarfsliste zu einer einzigen, offline lauffähigen HTML-Datei (Programm + Daten).

Ergebnis:
  Bedarfsliste.html            Programmdatei (leer, ohne Bedarfe) – nur für den allerersten Start
  Bedarfsliste_Update.zip      Update-Paket: nur das Programm, die Daten in der vorhandenen Datei bleiben
  Foerderplan_Vorlage.xlsx      leere Förderplan-Vorlage (über tools/vorlage.js, braucht Node)
  vorschau/Bedarfsliste_Vorschau.html   Vorschau mit Beispieldaten (ohne Speichern) für die Ansicht im Browser
"""
import base64, glob, json, os, subprocess, sys, zipfile
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, 'Bedarfsliste.html')
read = lambda p: open(p, encoding='utf8').read()

css = read(os.path.join(SRC, 'style.css'))
parts = sorted(glob.glob(os.path.join(SRC, '[0-9][0-9]_*.js')))
js = '\n'.join(read(f) for f in parts)
FAVICON = 'data:image/svg+xml,' + quote(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='13' fill='#E30714'/>"
    "<rect x='14' y='11' width='36' height='43' rx='5' fill='white'/><g fill='#E30714'><rect x='20' y='20' width='6' height='6' rx='1'/>"
    "<rect x='20' y='30' width='6' height='6' rx='1'/><rect x='20' y='40' width='6' height='6' rx='1'/></g><g fill='#404040'>"
    "<rect x='30' y='21' width='14' height='4' rx='2'/><rect x='30' y='31' width='14' height='4' rx='2'/><rect x='30' y='41' width='10' height='4' rx='2'/></g></svg>", safe="/:=' ")
# Versionsnummer und Änderungsliste (neueste zuerst); ohne Datum gilt die Bauzeit
CHANGELOG = json.load(open(os.path.join(SRC, 'changelog.json'), encoding='utf8'))
if not CHANGELOG[0].get('date'):
    from datetime import datetime
    from zoneinfo import ZoneInfo
    CHANGELOG[0]['date'] = datetime.now(ZoneInfo('Europe/Berlin')).strftime('%Y-%m-%dT%H:%M')
APP_INFO = {'version': CHANGELOG[0]['version'], 'date': CHANGELOG[0]['date']}
LOGO = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(SRC, 'logo.png'), 'rb').read()).decode()
LOGO_DARK = 'data:image/svg+xml;base64,' + base64.b64encode(open(os.path.join(SRC, 'logo_weiss.svg'), 'rb').read()).decode()


def program(demo):
    consts = {'DEMO': demo, 'LOGO': '' if demo else LOGO, 'LOGO_DARK': '' if demo else LOGO_DARK, 'FAVICON': FAVICON, 'APP_INFO': APP_INFO, 'CHANGELOG': CHANGELOG}
    head = ''.join('\nconst %s = %s;' % (k, json.dumps(v, ensure_ascii=False) if k != 'APP_INFO' else json.dumps(v)) for k, v in consts.items())
    code = js.replace("'use strict';", "'use strict';" + head, 1) + ('\n' + read(os.path.join(SRC, 'demo.js')) if demo else '')
    for bad in ('</script', '<!--'):
        assert bad not in code.lower(), bad
    return code


EMPTY = json.dumps({'meta': {'savedAt': None, 'rev': 0}, 'settings': {'kartei': ''}, 'bedarfe': []})
html = ('<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<title>Bedarfsliste</title>\n<link rel="icon" href="' + FAVICON + '">\n<style id="bl-style">' + css + '</style>\n</head>\n<body>\n<div id="app"></div>\n'
        '<script type="application/json" id="bl-data">' + EMPTY + '</script>\n<script id="bl-app">' + program(False) + '</script>\n</body>\n</html>\n')
open(OUT, 'w', encoding='utf8').write(html)
print('OK', OUT, len(html) // 1024, 'KB')

ZIP = os.path.join(HERE, 'Bedarfsliste_Update.zip')
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(OUT, os.path.basename(OUT))
print('OK', ZIP)

# Vorschau für die Ansicht im Browser (Artifact): ohne Dokumentrahmen, mit Beispieldaten, ohne Speichern
os.makedirs(os.path.join(HERE, 'vorschau'), exist_ok=True)
PREV = os.path.join(HERE, 'vorschau', 'Bedarfsliste_Vorschau.html')
prev = ('<title>Bedarfsliste</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style id="bl-style">' + css + '</style>\n<div id="app"></div>\n'
        '<script type="application/json" id="bl-data">' + EMPTY + '</script>\n<script id="bl-app">' + program(True) + '</script>\n')
open(PREV, 'w', encoding='utf8').write(prev)
print('OK', PREV)

# Leere Förderplan-Vorlage mit demselben Code wie in der App
try:
    subprocess.run(['node', os.path.join(HERE, 'tools', 'vorlage.js'), os.path.join(HERE, 'Foerderplan_Vorlage.xlsx')], check=True)
except (OSError, subprocess.CalledProcessError) as e:
    print('Hinweis: Förderplan-Vorlage nicht erzeugt (Node fehlt?):', e, file=sys.stderr)
