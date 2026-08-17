param(
  [Parameter(Mandatory=$true)][string]$BackupDirectory,
  [Parameter(Mandatory=$false)][string]$TargetDbUrl = $env:SUPABASE_RESTORE_DB_URL,
  [Parameter(Mandatory=$false)][string]$ExpectedTargetProjectRef = $env:SUPABASE_RESTORE_PROJECT_REF
)
$ErrorActionPreference="Stop"

if([string]::IsNullOrWhiteSpace($TargetDbUrl)){ throw "SUPABASE_RESTORE_DB_URL is not set." }
if([string]::IsNullOrWhiteSpace($ExpectedTargetProjectRef)){ throw "SUPABASE_RESTORE_PROJECT_REF is not set." }
if(-not (Test-Path $BackupDirectory)){ throw "Backup directory not found." }

$manifestPath=Join-Path $BackupDirectory "backup-manifest.json"
if(-not (Test-Path $manifestPath)){ throw "backup-manifest.json not found." }
$m=Get-Content $manifestPath -Raw | ConvertFrom-Json

$uri=[System.Uri]$TargetDbUrl
$match=$TargetDbUrl -match [regex]::Escape($ExpectedTargetProjectRef)

[pscustomobject]@{
  backup_directory=(Resolve-Path $BackupDirectory).Path
  backup_baseline=$m.baseline
  backup_created=$m.created_at_local
  target_host=$uri.Host
  expected_project_ref=$ExpectedTargetProjectRef
  project_ref_matches=$match
  storage_objects_included=$m.storage_objects_included
  production_restore_allowed=$false
} | Format-List

if(-not $match){ throw "Project ref mismatch. Preflight failed." }
Write-Host "PRECHECK OK: no restore was performed."
