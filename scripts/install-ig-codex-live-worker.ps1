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

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask -and $existingTask.State -eq 'Running') {
    Stop-ScheduledTask -TaskName $taskName
    $stopDeadline = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 200
        $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    } while ($existingTask -and $existingTask.State -eq 'Running' -and (Get-Date) -lt $stopDeadline)
    if ($existingTask -and $existingTask.State -eq 'Running') {
        throw "Timed out stopping the existing worker task: $taskName"
    }
}

Copy-Item -LiteralPath $sourceWorker -Destination $installedWorker -Force

$arguments = '"{0}" --workspace "{1}"' -f $installedWorker, $Workspace
$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $Workspace
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$watchdogTrigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 1) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$triggers = @($logonTrigger, $watchdogTrigger)
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -Description 'Runs the headless Codex worker for explicitly enabled paid IG and Facebook lead conversations.' `
    -Force | Out-Null

if (-not $NoStart) {
    Start-ScheduledTask -TaskName $taskName
}

Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
Write-Output "Installed worker: $installedWorker"
