@echo off
setlocal
rem ======================================================================
rem  Jahresplanung Aussenkommunikation - Start im eigenen Programmfenster
rem  Sucht die Programmdatei (Jahresplanung*.html) neben dieser Datei oder
rem  im Unterordner "Jahresplanung ..." und oeffnet sie in Microsoft Edge
rem  als App-Fenster (ohne Adressleiste und Tabs).
rem ======================================================================

set "JP_APP="
for %%F in ("%~dp0Jahresplanung*.html") do if not defined JP_APP set "JP_APP=%%~fF"
if not defined JP_APP for /d %%D in ("%~dp0Jahresplanung*") do for %%F in ("%%~fD\Jahresplanung*.html") do if not defined JP_APP set "JP_APP=%%~fF"
if not defined JP_APP goto :notfound

set "JP_EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "JP_EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined JP_EDGE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "JP_EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined JP_EDGE if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "JP_EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not defined JP_EDGE goto :nobrowser

rem Pfad als Datei-Adresse (Leerzeichen und Umlaute korrekt kodiert)
powershell -NoProfile -NonInteractive -Command "Start-Process -FilePath $env:JP_EDGE -ArgumentList ('--app=' + ([uri]$env:JP_APP).AbsoluteUri)" >nul 2>&1
if not errorlevel 1 exit /b 0

rem Falls PowerShell gesperrt ist: einfache Variante
set "JP_URL=%JP_APP:\=/%"
start "" "%JP_EDGE%" --app="file:///%JP_URL%"
exit /b 0

:nobrowser
rem Kein Edge gefunden: im Standardbrowser oeffnen
start "" "%JP_APP%"
exit /b 0

:notfound
echo.
echo   Die Programmdatei "Jahresplanung_Aussenkommunikation.html" wurde nicht gefunden.
echo   Sie muss neben dieser Startdatei oder im Unterordner "Jahresplanung (Programmdatei)" liegen.
echo.
pause
exit /b 1
