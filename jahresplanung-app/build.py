# -*- coding: utf-8 -*-
"""Baut die App zu einer einzigen, offline lauffähigen HTML-Datei (Programm + Daten)."""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'Jahresplanung_Aussenkommunikation.html')
data = json.load(open(os.path.join(HERE, 'src', 'initial_data.json'), encoding='utf8'))
tpl = next(m['plan'] for m in data['massnahmen'] if m.get('plan'))
css = open(os.path.join(HERE, 'src', 'style.css'), encoding='utf8').read()
js = '\n'.join(open(f, encoding='utf8').read() for f in sorted(glob.glob(os.path.join(HERE, 'src', '[0-9][0-9]_*.js'))))
js = js.replace("'use strict';", "'use strict';\nconst MAILING_TEMPLATE = " + json.dumps(tpl, ensure_ascii=False) + ";", 1)
for bad in ('</script', '<!--'):
    assert bad not in js.lower(), bad
dj = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
html = ('<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<title>Jahresplanung Außenkommunikation</title>\n<style id="jp-style">' + css + '</style>\n</head>\n<body>\n<div id="app"></div>\n'
        '<script type="application/json" id="jp-data">' + dj + '</script>\n<script id="jp-app">' + js + '</script>\n</body>\n</html>\n')
open(OUT, 'w', encoding='utf8').write(html)
print('OK', OUT, len(html) // 1024, 'KB')
