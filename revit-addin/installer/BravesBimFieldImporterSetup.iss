; Braves BIM Field Importer — instalador .exe para Revit 2024/2025/2026
;
; Isto é um script do Inno Setup (ferramenta gratuita, baixe em
; https://jrsoftware.org/isinfo.php — "Inno Setup Compiler"). Ele NÃO
; compila o add-in: você precisa ter compilado a solução no Visual Studio
; antes (configuração Release, plataforma x64 — veja o README principal),
; o que gera os arquivos que este script empacota.
;
; Como gerar o instalador .exe:
;   1. Compile BravesBimFieldImporter.sln no Visual Studio (Release, x64).
;      Isso cria tanto a build net48 (Revit 2024) quanto net8.0-windows
;      (Revit 2025/2026) em pastas separadas sob bin\x64\Release\.
;   2. Abra este arquivo (BravesBimFieldImporterSetup.iss) no Inno Setup
;      Compiler.
;   3. Build → Compile (ou Ctrl+F9).
;   4. O instalador sai em installer\Output\BravesBimFieldImporterSetup.exe
;      — é esse arquivo que você distribui/roda na máquina com o Revit.
;
; O instalador em si só extrai os arquivos e roda install.ps1 (na raiz de
; revit-addin\), que é quem realmente detecta as versões do Revit
; instaladas e copia os arquivos certos pra pasta de Addins de cada uma —
; toda a lógica de instalação mora lá, não duplicada aqui em Pascal.

#define MyAppName "Braves BIM Field Importer"
#define MyAppVersion "1.0"
#define MyAppPublisher "Braves Engenharia"

[Setup]
AppId={{7A2B1E4D-6F3C-4A8E-9D5B-1C4F8E2A9B60}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Braves\BimFieldImporter
DisableProgramGroupPage=yes
; Não é um app "Program Files" normal (é um add-in copiado pra pasta de
; Addins do usuário), mas precisamos de um local temporário pra extrair os
; arquivos antes do install.ps1 rodar — privilégios de usuário já bastam.
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=BravesBimFieldImporterSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
; Sem add-in de 32 bits — Revit é x64 há anos.
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
; Build net48 (Revit 2024).
Source: "..\BravesBimFieldImporter\bin\x64\Release\net48\BravesBimFieldImporter.dll"; DestDir: "{app}\BravesBimFieldImporter\bin\x64\Release\net48"; Flags: ignoreversion
Source: "..\BravesBimFieldImporter\bin\x64\Release\net48\Newtonsoft.Json.dll"; DestDir: "{app}\BravesBimFieldImporter\bin\x64\Release\net48"; Flags: ignoreversion
Source: "..\BravesBimFieldImporter\bin\x64\Release\net48\firebase.config.json.example"; DestDir: "{app}\BravesBimFieldImporter\bin\x64\Release\net48"; Flags: ignoreversion skipifsourcedoesntexist

; Build net8.0-windows (Revit 2025 e 2026 — mesmo binário pros dois).
Source: "..\BravesBimFieldImporter\bin\x64\Release\net8.0-windows\BravesBimFieldImporter.dll"; DestDir: "{app}\BravesBimFieldImporter\bin\x64\Release\net8.0-windows"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\BravesBimFieldImporter\bin\x64\Release\net8.0-windows\Newtonsoft.Json.dll"; DestDir: "{app}\BravesBimFieldImporter\bin\x64\Release\net8.0-windows"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\BravesBimFieldImporter\bin\x64\Release\net8.0-windows\firebase.config.json.example"; DestDir: "{app}\BravesBimFieldImporter\bin\x64\Release\net8.0-windows"; Flags: ignoreversion skipifsourcedoesntexist

; Manifesto e o próprio instalador (install.ps1 fica na raiz de revit-addin,
; junto do .addin, igual na pasta fonte — install.ps1 localiza tudo por
; caminho relativo a ele mesmo via $PSScriptRoot).
Source: "..\BravesBimFieldImporter.addin"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\install.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Run]
; -ExecutionPolicy Bypass só vale pra este processo do PowerShell, não muda
; nenhuma configuração permanente da máquina do usuário.
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install.ps1"""; \
    WorkingDir: "{app}"; Flags: runascurrentuser waituntilterminated; \
    StatusMsg: "Detectando versões do Revit instaladas e copiando o add-in..."

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install.ps1"" -Uninstall"; \
    WorkingDir: "{app}"; Flags: runascurrentuser waituntilterminated
