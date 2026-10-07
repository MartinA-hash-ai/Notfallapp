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
echo  [3] PowerShell:
set "JP_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%JP_PS%" set "JP_PS=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not exist "%JP_PS%" echo      NICHT GEFUNDEN
if not exist "%JP_PS%" goto :plain
echo      %JP_PS%
echo.
echo  [4] Standardbrowser ermitteln und starten ...
"%JP_PS%" -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $u=([uri]$env:JP_APP).AbsoluteUri; $p=$null; $c=$null; $e=$null; try { $p=(Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice').ProgId; $c=(Get-Item -LiteralPath ('Registry::HKEY_CLASSES_ROOT\'+$p+'\shell\open\command')).GetValue('').Trim(); $q=[char]34; if ($c.StartsWith($q)) { $e=$c.Split($q)[1] } else { $e=$c.Split(' ')[0] }; if (-not (Test-Path -LiteralPath $e)) { $e=$null } } catch { $e=$null }; $app=$false; if ($e) { $app=@('msedge.exe','chrome.exe','brave.exe','vivaldi.exe') -contains [IO.Path]::GetFileName($e).ToLower() }; Write-Host ('      Standardbrowser: '+$p); Write-Host ('      Programm: '+$e); Write-Host ('      als Programmfenster: '+$app); Write-Host ('      Adresse: '+$u); if ($e -and $app) { Start-Process -FilePath $e -ArgumentList ('--app='+$u) } elseif ($e) { Start-Process -FilePath $e -ArgumentList $u } else { Start-Process -FilePath $env:JP_APP }"
echo      Rueckgabewert: %errorlevel%
echo.
echo  Hat sich das Programm geoeffnet? Wenn nicht: Taste druecken, dann
echo  oeffnet Windows die Datei direkt mit dem Standardprogramm.
pause >nul
:plain
echo.
echo  [5] Datei direkt mit dem Standardprogramm oeffnen ...
start "" "%JP_APP%"
echo      Rueckgabewert: %errorlevel%
:ende
echo.
echo  Bitte von diesem Fenster ein Bildschirmfoto machen und schicken
echo  und dazuschreiben, was sich geoeffnet hat (nichts / leeres Fenster /
echo  Browser ohne Programm / Fehlermeldung).
echo.
pause
exit /b 0
