#!/bin/sh
# Alle Tests gegen die gebaute Datei laufen lassen:  sh tests/run.sh   (vorher: python3 build.py)
# Einzelne Tests: sh tests/run.sh t02 t04 · mit Bildschirmfotos: SHOTS=1
# Jeder Test läuft in einem eigenen Ordner tests/out/<test>/, seine Ausgabe steht in tests/out/<test>.log
cd "$(dirname "$0")" || exit 1
if [ "$1" = "--one" ]; then
  n=$2; mkdir -p "out/$n" && cd "out/$n" || exit 1
  timeout 300 node "../../$n.js" > "../$n.log" 2>&1; rc=$?
  nf=$(grep -c '^FAIL' "../$n.log")
  err=$(grep '^ERR' "../$n.log" | grep -v 'ERR keine' | head -1)
  if [ $rc -ne 0 ] || [ "$nf" -gt 0 ] || [ -n "$err" ]; then
    printf '✗ %s (FAIL: %s, Exit: %s)\n%s\n' "$n" "$nf" "$rc" "$(grep -E '^(FAIL|ERR)|Error' "../$n.log" | head -8)"; exit 1
  fi
  echo "✓ $n"; exit 0
fi
mkdir -p out || exit 1
if [ $# -gt 0 ]; then list="$*"; else list=$(ls t[0-9][0-9]*.js | sed 's/\.js$//'); fi
printf '%s\n' $list | xargs -P "${J:-4}" -n 1 sh ./run.sh --one
