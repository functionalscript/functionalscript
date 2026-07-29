param(
  [ValidateSet("sync", "check")]
  [string]$Mode = "sync",
  [string]$SourceFile
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source = if ($SourceFile) { (Resolve-Path $SourceFile).Path } else { Join-Path $repoRoot ".copilot\mcp.json" }
$targetDir = Join-Path $repoRoot ".vscode"
$target = Join-Path $targetDir "mcp.json"

if (-not (Test-Path $source)) {
  throw "MCP source file is missing: $source"
}

if (-not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Path $targetDir | Out-Null
}

$sourceText = [System.IO.File]::ReadAllText($source)
$targetText = if (Test-Path $target) { [System.IO.File]::ReadAllText($target) } else { $null }

if ($Mode -eq "check") {
  if ($sourceText -ne $targetText) {
    Write-Error ".vscode/mcp.json is out of sync with .copilot/mcp.json. Run: powershell -ExecutionPolicy Bypass -File .\scripts\sync-mcp.ps1 -Mode sync"
    exit 1
  }
  exit 0
}

if ($sourceText -ne $targetText) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($target, $sourceText, $utf8NoBom)
}
