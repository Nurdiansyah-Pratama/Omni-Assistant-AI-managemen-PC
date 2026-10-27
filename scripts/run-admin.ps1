param(
  [ValidateSet("dev", "start")]
  [string]$ScriptName = "dev",
  [Parameter(Mandatory = $true)]
  [string]$NodePath,
  [Parameter(Mandatory = $true)]
  [string]$NpmCliPath
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$escapedRoot = $projectRoot.Replace("'", "''")
$escapedNode = $NodePath.Replace("'", "''")
$escapedNpmCli = $NpmCliPath.Replace("'", "''")
$command = "Set-Location -LiteralPath '$escapedRoot'; & '$escapedNode' '$escapedNpmCli' run $ScriptName"
$encodedCommand = [Convert]::ToBase64String(
  [Text.Encoding]::Unicode.GetBytes($command)
)
$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

Start-Process $powershellPath `
  -Verb RunAs `
  -WorkingDirectory $projectRoot `
  -ArgumentList @(
    "-NoLogo",
    "-NoProfile",
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    $encodedCommand
  )
