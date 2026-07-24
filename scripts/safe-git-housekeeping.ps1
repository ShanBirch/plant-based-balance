[CmdletBinding()]
param(
    [string]$RepoRoot = '',
    [ValidateRange(1, 168)]
    [int]$MinimumAgeHours = 12,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    $RepoRoot = Split-Path -Parent $scriptDirectory
}

function Invoke-Git {
    $gitArguments = @($args)

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = @(& git -C $script:ResolvedRepoRoot @gitArguments 2>&1)
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($exitCode -ne 0) {
        throw "git $($gitArguments -join ' ') failed:`n$($output -join "`n")"
    }
    return $output
}

function Get-Worktrees {
    $items = @()
    $current = $null

    foreach ($line in (Invoke-Git worktree list --porcelain)) {
        if ($line -like 'worktree *') {
            if ($null -ne $current) { $items += [pscustomobject]$current }
            $current = [ordered]@{
                Path = $line.Substring(9)
                Head = ''
                Branch = ''
                Locked = $false
                Prunable = $false
            }
        } elseif ($line -like 'HEAD *') {
            $current.Head = $line.Substring(5)
        } elseif ($line -like 'branch *') {
            $current.Branch = $line.Substring(7)
        } elseif ($line -like 'locked*') {
            $current.Locked = $true
        } elseif ($line -like 'prunable *') {
            $current.Prunable = $true
        }
    }

    if ($null -ne $current) { $items += [pscustomobject]$current }
    return $items
}

$script:ResolvedRepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$repoTopLevel = (Invoke-Git rev-parse --show-toplevel | Select-Object -Last 1).Trim()
if (-not $script:ResolvedRepoRoot.Equals($repoTopLevel.Replace('/', '\'), [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to run outside the repository root: $script:ResolvedRepoRoot"
}
$commonGitDirectory = [System.IO.Path]::GetFullPath(
    (Invoke-Git rev-parse --path-format=absolute --git-common-dir | Select-Object -Last 1).Trim()
)

Invoke-Git fetch origin main --prune | Out-Null
$originMain = (Invoke-Git rev-parse origin/main | Select-Object -Last 1).Trim()
$cutoff = [DateTimeOffset]::UtcNow.AddHours(-$MinimumAgeHours).ToUnixTimeSeconds()
$commandLines = (Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine } |
    Select-Object -ExpandProperty CommandLine) -join "`n"

$removedWorktrees = 0
$removedBranches = 0
$preserved = @()

foreach ($worktree in (Get-Worktrees)) {
    $candidatePath = $worktree.Path.Replace('/', '\')
    if ($candidatePath.Equals($script:ResolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) { continue }

    if ($worktree.Prunable -or -not (Test-Path -LiteralPath $candidatePath)) {
        if ($Apply) { Invoke-Git worktree prune | Out-Null }
        continue
    }

    $candidateCommonGit = @(& git -C $candidatePath rev-parse --path-format=absolute --git-common-dir 2>$null) | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0 -or -not $candidateCommonGit -or
        -not [System.IO.Path]::GetFullPath($candidateCommonGit.Trim()).Equals($commonGitDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
        $preserved += "$candidatePath (repository identity mismatch)"
        continue
    }

    if ($worktree.Locked -or $commandLines -like "*$candidatePath*") {
        $preserved += "$candidatePath (locked or active)"
        continue
    }

    $commitTimeText = @(& git -C $candidatePath show -s --format=%ct $worktree.Head 2>$null) | Select-Object -Last 1
    $commitTime = 0L
    if (-not [long]::TryParse($commitTimeText, [ref]$commitTime) -or $commitTime -gt $cutoff) {
        $preserved += "$candidatePath (inside grace period)"
        continue
    }

    $status = @(& git -C $candidatePath status --porcelain=v1 --untracked-files=all 2>$null)
    if ($LASTEXITCODE -ne 0 -or $status.Count -gt 0) {
        $preserved += "$candidatePath (dirty)"
        continue
    }

    & git -C $script:ResolvedRepoRoot merge-base --is-ancestor $worktree.Head $originMain 2>$null
    if ($LASTEXITCODE -ne 0) {
        $preserved += "$candidatePath (not in origin/main)"
        continue
    }

    if ($Apply) {
        Invoke-Git worktree remove --force -- $candidatePath | Out-Null
    }
    $removedWorktrees++
    Write-Output "$(if ($Apply) { 'Removed' } else { 'Would remove' }) worktree: $candidatePath"
}

if ($Apply) { Invoke-Git worktree prune | Out-Null }

$checkedOutBranches = @((Get-Worktrees).Branch | Where-Object { $_ } | ForEach-Object { $_ -replace '^refs/heads/', '' })
$currentBranch = (Invoke-Git branch --show-current | Select-Object -Last 1).Trim()
foreach ($branch in (Invoke-Git for-each-ref --format='%(refname:short)|%(committerdate:unix)' refs/heads)) {
    $parts = $branch -split '\|', 2
    $branchName = $parts[0]
    $branchTime = 0L
    [void][long]::TryParse($parts[1], [ref]$branchTime)

    if ($branchName -eq $currentBranch -or $checkedOutBranches -contains $branchName -or $branchTime -gt $cutoff) { continue }
    & git -C $script:ResolvedRepoRoot merge-base --is-ancestor $branchName $originMain 2>$null
    if ($LASTEXITCODE -ne 0) {
        $preserved += "branch $branchName (not in origin/main)"
        continue
    }

    if ($Apply) { Invoke-Git branch -D -- $branchName | Out-Null }
    $removedBranches++
    Write-Output "$(if ($Apply) { 'Removed' } else { 'Would remove' }) branch: $branchName"
}

Write-Output "Safe Git housekeeping complete. Worktrees: $removedWorktrees. Branches: $removedBranches. Preserved: $($preserved.Count). Apply: $Apply."
if ($preserved.Count -gt 0) {
    $preserved | ForEach-Object { Write-Output "Preserved: $_" }
}
