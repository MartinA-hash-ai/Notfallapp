@echo off
setlocal
rem ======================================================================
rem  Jahresplanung - Diagnose der Startdatei
rem  Zeigt Schritt fuer Schritt, was beim Start passiert, und haelt an.
rem  In den Mailing-Ordner neben "Jahresplanung starten.cmd" legen,
rem  doppelklicken und vom Fenster ein Bildschirmfoto schicken.
rem ======================================================================
echo.
echo  === Jahresplanung - Diagnose ===
echo.
echo  [1] Ordner der Startdatei:
echo      %~dp0
set "JP_NAME=Jahresplanung_Aussenkommunikation.html"
set "JP_APP="
if exist "%~dp0%JP_NAME%" set "JP_APP=%~dp0%JP_NAME%"
if not defined JP_APP for /d %%D in ("%~dp0Jahresplanung*") do if not defined JP_APP if exist "%%~fD\%JP_NAME%" set "JP_APP=%%~fD\%JP_NAME%"
if not defined JP_APP for %%F in ("%~dp0Jahresplanung*.html") do if not defined JP_APP set "JP_APP=%%~fF"
if not defined JP_APP for /d %%D in ("%~dp0Jahresplanung*") do for %%F in ("%%~fD\Jahresplanung*.html") do if not defined JP_APP set "JP_APP=%%~fF"
echo.
echo  [2] Programmdatei:
if not defined JP_APP echo      NICHT GEFUNDEN
if not defined JP_APP goto :ende
echo      %JP_APP%
for %%A in ("%JP_APP%") do echo      Groesse: %%~zA Bytes, Attribute: %%~aA
echo.
echo  [3] Edge:
set "JP_EDGE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "JP_EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined JP_EDGE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "JP_EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined JP_EDGE if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "JP_EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if defined JP_EDGE echo      %JP_EDGE%
if not defined JP_EDGE echo      an den ueblichen Orten nicht gefunden
set "JP_REG=%SystemRoot%\System32\reg.exe"
if not defined JP_EDGE if exist "%JP_REG%" call :regedge "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"
if not defined JP_EDGE if exist "%JP_REG%" call :regedge "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"
if not defined JP_EDGE if exist "%JP_REG%" call :regedge "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"
if defined JP_REGHIT echo      laut Registrierung: %JP_EDGE%
if not defined JP_EDGE echo      auch in der Registrierung nicht gefunden
echo      Standardbrowser:
if exist "%JP_REG%" for /f "tokens=2,*" %%A in ('%JP_REG% query "HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice" /v ProgId 2^>nul') do if /i "%%A"=="REG_SZ" echo      %%B
echo.
echo  [4] PowerShell:
set "JP_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%JP_PS%" set "JP_PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not exist "%JP_PS%" echo      NICHT GEFUNDEN
if not exist "%JP_PS%" goto :tab
echo      %JP_PS%
set "JP_EXE=%JP_EDGE%"
if not defined JP_EXE set "JP_EXE=msedge"
echo.
echo  [5] Start als Programmfenster ueber PowerShell (%JP_EXE%) ...
"%JP_PS%" -NoProfile -NonInteractive -Command "$u = ([uri]$env:JP_APP).AbsoluteUri; Write-Host ('      Adresse: ' + $u); Start-Process -FilePath $env:JP_EXE -ArgumentList ('--app=' + $u)"
echo      Rueckgabewert: %errorlevel%
echo.
echo  Hat sich das Programm geoeffnet? Wenn nicht: Taste druecken, dann
echo  versuche ich es als normales Fenster.
pause >nul
:tab
echo.
if defined JP_EDGE echo  [6] Start als normales Edge-Fenster ...
if defined JP_EDGE start "" "%JP_EDGE%" --new-window "%JP_APP%"
if not defined JP_EDGE echo  [6] Start im Standardbrowser ...
if not defined JP_EDGE start "" "%JP_APP%"
echo      Rueckgabewert: %errorlevel%
:ende
echo.
echo  Bitte von diesem Fenster ein Bildschirmfoto machen und schicken
echo  und dazuschreiben, was sich geoeffnet hat (nichts / leeres Fenster /
echo  Edge ohne Programm / Fehlermeldung).
echo.
pause
exit /b 0

:regedge
for /f "tokens=2,*" %%A in ('%JP_REG% query "%~1" /ve 2^>nul') do if /i "%%A"=="REG_SZ" if exist "%%~B" set "JP_EDGE=%%~B"
if defined JP_EDGE set "JP_REGHIT=1"
exit /b 0
