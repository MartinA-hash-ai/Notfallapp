#!/bin/sh
# Alle Tests gegen die gebaute Datei laufen lassen:  sh tests/run.sh   (vorher: python3 build.py)
# Einzelner Test: sh tests/run.sh t20      Ausgaben (Bilder, PDFs, Downloads) landen in tests/out/
cd "$(dirname "$0")" || exit 1
mkdir -p out && cd out || exit 1
fail=0
for t in ../t[0-9][0-9]*.js; do
  n=$(basename "$t" .js)
  [ -n "$1" ] && [ "$1" != "$n" ] && continue
  out=$(timeout 300 node "$t" 2>&1); rc=$?
  nf=$(printf '%s\n' "$out" | grep -c '^FAIL')
  err=$(printf '%s\n' "$out" | grep '^ERR' | grep -v 'ERR keine' | head -1)
  if [ $rc -ne 0 ] || [ "$nf" -gt 0 ] || [ -n "$err" ]; then
    fail=1; echo "✗ $n (FAIL: $nf, Exit: $rc)"; printf '%s\n' "$out" | grep -E '^(FAIL|ERR)|Error' | head -8
  else echo "✓ $n"; fi
done
exit $fail
