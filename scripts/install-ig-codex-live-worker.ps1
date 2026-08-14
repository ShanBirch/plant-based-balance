param(
    [string]$Workspace = 'C:\Users\shann\.gemini\antigravity\plant_based_balance',
    [switch]$Uninstall,
    [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$taskName = 'Balance IG Paid Lead Live Codex Worker'
$installRoot = Join-Path $env:LOCALAPPDATA 'Balance\CodexLiveWorker'
$installedWorker = Join-Path $installRoot 'ig-codex-live-worker.mjs'

if ($Uninstall) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Output "Removed scheduled task: $taskName"
    exit 0
}

$sourceWorker = Join-Path $PSScriptRoot 'ig-codex-live-worker.mjs'
if (-not (Test-Path -LiteralPath $sourceWorker)) {
    throw "Worker source is missing: $sourceWorker"
}
if (-not (Test-Path -LiteralPath $Workspace)) {
    throw "Balance workspace is missing: $Workspace"
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
Copy-Item -LiteralPath $sourceWorker -Destination $installedWorker -Force

$arguments = '"{0}" --workspace "{1}" --open-chat' -f $installedWorker, $Workspace
$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $Workspace
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description 'Wakes a persistent Codex chat for explicitly enabled paid IG and Facebook lead conversations.' `
    -Force | Out-Null

if (-not $NoStart) {
    Start-ScheduledTask -TaskName $taskName
}

Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
Write-Output "Installed worker: $installedWorker"
