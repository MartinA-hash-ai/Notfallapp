@echo off
setlocal
rem ======================================================================
rem  Jahresplanung Aussenkommunikation - Start im Standardbrowser
rem  Oeffnet die Programmdatei Jahresplanung_Aussenkommunikation.html neben
rem  dieser Datei oder im Unterordner "Jahresplanung ..." immer im
rem  Standardbrowser von Windows. Ist das Edge oder Chrome (auch Brave,
rem  Vivaldi), oeffnet sie sich als eigenes Programmfenster ohne
rem  Adressleiste und Tabs; sonst als normales Browserfenster.
rem  Zuerst immer der genaue Dateiname - Kopien wie "...-LAPTOP.html" oder
rem  "... (1).html" (entstehen z. B. bei OneDrive-Konflikten) werden nur
rem  genommen, wenn die Hauptdatei fehlt.
rem  Den Standardbrowser und die kodierte Adresse (Umlaute wie in
rem  "Dioezese", Leerzeichen) ermittelt PowerShell - mit vollem Pfad, weil
rem  auf manchen Rechnern der Suchpfad unvollstaendig ist. Geht das nicht,
rem  oeffnet Windows die Datei direkt mit dem Standardprogramm.
rem  Speichern direkt in den Mailing-Ordner koennen nur Edge und Chrome.
rem ======================================================================

set "JP_NAME=Jahresplanung_Aussenkommunikation.html"
set "JP_APP="
if exist "%~dp0%JP_NAME%" set "JP_APP=%~dp0%JP_NAME%"
if not defined JP_APP for /d %%D in ("%~dp0Jahresplanung*") do if not defined JP_APP if exist "%%~fD\%JP_NAME%" set "JP_APP=%%~fD\%JP_NAME%"
if not defined JP_APP for %%F in ("%~dp0Jahresplanung*.html") do if not defined JP_APP set "JP_APP=%%~fF"
if not defined JP_APP for /d %%D in ("%~dp0Jahresplanung*") do for %%F in ("%%~fD\Jahresplanung*.html") do if not defined JP_APP set "JP_APP=%%~fF"
if not defined JP_APP goto :notfound

set "JP_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%JP_PS%" set "JP_PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not exist "%JP_PS%" goto :plain
"%JP_PS%" -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $u=([uri]$env:JP_APP).AbsoluteUri; $p=$null; $c=$null; $e=$null; try { $p=(Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice').ProgId; $c=(Get-Item -LiteralPath ('Registry::HKEY_CLASSES_ROOT\'+$p+'\shell\open\command')).GetValue('').Trim(); $q=[char]34; if ($c.StartsWith($q)) { $e=$c.Split($q)[1] } else { $e=$c.Split(' ')[0] }; if (-not (Test-Path -LiteralPath $e)) { $e=$null } } catch { $e=$null }; $app=$false; if ($e) { $app=@('msedge.exe','chrome.exe','brave.exe','vivaldi.exe') -contains [IO.Path]::GetFileName($e).ToLower() }; if ($e -and $app) { Start-Process -FilePath $e -ArgumentList ('--app='+$u) } elseif ($e) { Start-Process -FilePath $e -ArgumentList $u } else { Start-Process -FilePath $env:JP_APP }" >nul 2>&1
if not errorlevel 1 exit /b 0

:plain
rem Ohne PowerShell: Windows oeffnet die Datei mit dem Standardprogramm fuer HTML-Dateien
start "" "%JP_APP%"
exit /b 0

:notfound
echo.
echo   Die Programmdatei "Jahresplanung_Aussenkommunikation.html" wurde nicht gefunden.
echo   Sie muss neben dieser Startdatei oder im Unterordner "Jahresplanung (Programmdatei)" liegen.
echo.
pause
exit /b 1
