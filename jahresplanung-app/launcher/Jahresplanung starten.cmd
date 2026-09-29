@echo off
setlocal
rem ======================================================================
rem  Jahresplanung Aussenkommunikation - Start im eigenen Programmfenster
rem  Oeffnet die Programmdatei Jahresplanung_Aussenkommunikation.html neben
rem  dieser Datei oder im Unterordner "Jahresplanung ..." in Microsoft Edge
rem  als App-Fenster (ohne Adressleiste und Tabs).
rem  Zuerst immer der genaue Dateiname - Kopien wie "...-LAPTOP.html" oder
rem  "... (1).html" (entstehen z. B. bei OneDrive-Konflikten) werden nur
rem  genommen, wenn die Hauptdatei fehlt.
rem ======================================================================

set "JP_NAME=Jahresplanung_Aussenkommunikation.html"
set "JP_APP="
if exist "%~dp0%JP_NAME%" set "JP_APP=%~dp0%JP_NAME%"
if not defined JP_APP for /d %%D in ("%~dp0Jahresplanung*") do if not defined JP_APP if exist "%%~fD\%JP_NAME%" set "JP_APP=%%~fD\%JP_NAME%"
if not defined JP_APP for %%F in ("%~dp0Jahresplanung*.html") do if not defined JP_APP set "JP_APP=%%~fF"
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
