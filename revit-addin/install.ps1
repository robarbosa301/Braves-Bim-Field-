<#
.SYNOPSIS
  Instala (ou desinstala) o add-in Braves BIM Field Importer nas versões do
  Revit encontradas na máquina (2024, 2025 e/ou 2026).

.DESCRIPTION
  Depois de compilar a solução no Visual Studio (configuração Release,
  plataforma x64 — veja o README), rode este script. Ele:

    1. Detecta quais de Revit 2024/2025/2026 estão instalados (checando
       C:\Program Files\Autodesk\Revit <ano>).
    2. Para cada versão encontrada, copia a build certa (net48 pro 2024,
       net8.0-windows pro 2025 e 2026 — Autodesk trocou o runtime dos
       add-ins de .NET Framework pra .NET 8 a partir do 2025) pra
       %APPDATA%\Autodesk\Revit\Addins\<ano>\, junto com o manifesto
       .addin e as dependências (Newtonsoft.Json.dll).
    3. Desbloqueia os arquivos automaticamente (equivalente a clicar em
       Propriedades → Desbloquear) — evita o problema mais comum de add-in
       "sumido" sem erro nenhum.
    4. NÃO sobrescreve um firebase.config.json que você já configurou — só
       copia o .example se ainda não existir nenhum.

.PARAMETER Configuration
  Debug ou Release (padrão: Release).

.PARAMETER Versions
  Quais versões tentar instalar, separadas por vírgula (padrão: 2024,2025,2026).
  Útil se você só quer reinstalar numa versão específica, ex: -Versions 2026

.PARAMETER Uninstall
  Remove os arquivos que este script colocou (não mexe no
  firebase.config.json, pra não perder sua configuração).

.EXAMPLE
  .\install.ps1
  Instala em todas as versões do Revit encontradas na máquina.

.EXAMPLE
  .\install.ps1 -Versions 2026 -Configuration Debug
  Instala só no Revit 2026, usando a build Debug.

.EXAMPLE
  .\install.ps1 -Uninstall
  Remove o add-in de todas as versões onde este script o instalou.
#>
[CmdletBinding()]
param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",

    [string[]]$Versions = @("2024", "2025", "2026"),

    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# TFM (target framework moniker) usado em cada ano do Revit — ver a nota no
# .csproj: 2025 e 2026 compartilham o mesmo build net8.0-windows.
$tfmByVersion = @{
    "2024" = "net48"
    "2025" = "net8.0-windows"
    "2026" = "net8.0-windows"
}

$scriptRoot = $PSScriptRoot
$projectDir = Join-Path $scriptRoot "BravesBimFieldImporter"
$addinManifest = Join-Path $scriptRoot "BravesBimFieldImporter.addin"
$addinsRoot = Join-Path $env:APPDATA "Autodesk\Revit\Addins"

function Write-Step($msg) { Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "   AVISO: $msg" -ForegroundColor Yellow }
function Write-Err2($msg) { Write-Host "   ERRO: $msg" -ForegroundColor Red }

function Get-RevitInstallDir([string]$version) {
    $candidate = "C:\Program Files\Autodesk\Revit $version"
    if (Test-Path $candidate) { return $candidate }
    return $null
}

function Unblock-Directory([string]$dir) {
    Get-ChildItem -Path $dir -File -ErrorAction SilentlyContinue | ForEach-Object {
        try { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue } catch {}
    }
}

function Uninstall-Version([string]$version) {
    $target = Join-Path $addinsRoot $version
    if (-not (Test-Path $target)) {
        Write-Warn2 "Revit $version — nada instalado em $target."
        return
    }
    $toRemove = @("BravesBimFieldImporter.dll", "Newtonsoft.Json.dll", "BravesBimFieldImporter.addin")
    $removedAny = $false
    foreach ($f in $toRemove) {
        $p = Join-Path $target $f
        if (Test-Path $p) {
            Remove-Item $p -Force
            $removedAny = $true
        }
    }
    if ($removedAny) {
        Write-Ok "Revit $version — add-in removido de $target."
        Write-Warn2 "firebase.config.json (se existir) foi mantido — apague manualmente se quiser."
    } else {
        Write-Warn2 "Revit $version — nenhum arquivo do add-in encontrado em $target."
    }
}

function Install-Version([string]$version) {
    $revitDir = Get-RevitInstallDir $version
    if (-not $revitDir) {
        Write-Warn2 "Revit $version não encontrado nesta máquina (pulando)."
        return
    }

    $tfm = $tfmByVersion[$version]
    $buildDir = Join-Path $projectDir "bin\x64\$Configuration\$tfm"
    $dll = Join-Path $buildDir "BravesBimFieldImporter.dll"

    if (-not (Test-Path $dll)) {
        Write-Err2 "Revit $version encontrado, mas não achei a build em:"
        Write-Err2 "  $dll"
        Write-Err2 "Compile a solução primeiro (Visual Studio, configuração $Configuration, plataforma x64 — veja o README)."
        return
    }

    $target = Join-Path $addinsRoot $version
    New-Item -ItemType Directory -Path $target -Force | Out-Null

    Copy-Item $dll -Destination $target -Force

    $newtonsoft = Join-Path $buildDir "Newtonsoft.Json.dll"
    if (Test-Path $newtonsoft) {
        Copy-Item $newtonsoft -Destination $target -Force
    } else {
        Write-Warn2 "Newtonsoft.Json.dll não encontrada na build — a importação pode falhar ao carregar."
    }

    Copy-Item $addinManifest -Destination $target -Force

    $destConfig = Join-Path $target "firebase.config.json"
    $destConfigExample = Join-Path $target "firebase.config.json.example"
    $srcConfigExample = Join-Path $buildDir "firebase.config.json.example"
    if (Test-Path $srcConfigExample) {
        if (-not (Test-Path $destConfig)) {
            Copy-Item $srcConfigExample -Destination $destConfigExample -Force
        }
        # Se já existe firebase.config.json configurado, não mexe nele.
    }

    Unblock-Directory $target

    Write-Ok "Revit $version — instalado em $target (build $tfm/$Configuration)."
}

Write-Host ""
Write-Host "Braves BIM Field Importer — instalador do add-in Revit" -ForegroundColor White
Write-Host "========================================================"
Write-Host ""

if ($Uninstall) {
    Write-Step "Desinstalando..."
    foreach ($v in $Versions) { Uninstall-Version $v }
} else {
    Write-Step "Instalando (configuração: $Configuration)..."
    foreach ($v in $Versions) { Install-Version $v }
    Write-Host ""
    Write-Step "Lembrete: se ainda não configurou a importação pela nuvem, edite"
    Write-Step "firebase.config.json (renomeado do .example) em cada pasta de Addins"
    Write-Step "onde o add-in foi instalado — veja o README, seção 'Configurar a"
    Write-Step "importação pela nuvem'."
}

Write-Host ""
Write-Host "Concluído." -ForegroundColor White
