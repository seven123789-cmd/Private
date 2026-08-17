param(
  [Parameter(Mandatory=$true)][string]$BackupDirectory,
  [Parameter(Mandatory=$false)][string]$TargetDbUrl = $env:SUPABASE_RESTORE_DB_URL,
  [Parameter(Mandatory=$false)][string]$ExpectedTargetProjectRef = $env:SUPABASE_RESTORE_PROJECT_REF,
  [Parameter(Mandatory=$false)][switch]$AllowProductionLikeHost
)

$ErrorActionPreference = "Stop"

function Fail($msg){ throw $msg }

if ([string]::IsNullOrWhiteSpace($TargetDbUrl)) {
  Fail "SUPABASE_RESTORE_DB_URL is not set. Do not use the production connection string by default."
}
if ([string]::IsNullOrWhiteSpace($ExpectedTargetProjectRef)) {
  Fail "SUPABASE_RESTORE_PROJECT_REF is not set. Explicitly identify the restore target project."
}
if (-not (Test-Path $BackupDirectory)) {
  Fail "Backup directory not found: $BackupDirectory"
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Fail "psql was not found."
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Fail "Supabase CLI was not found."
}

$manifestPath = Join-Path $BackupDirectory "backup-manifest.json"
if (-not (Test-Path $manifestPath)) {
  Fail "backup-manifest.json not found."
}
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

# Integrity verification first.
$verifyScript = Join-Path $PSScriptRoot "..\backup\verify-backup.ps1"
if (-not (Test-Path $verifyScript)) {
  Fail "verify-backup.ps1 not found: $verifyScript"
}
& $verifyScript -BackupDirectory $BackupDirectory
if ($LASTEXITCODE -ne 0) {
  Fail "Backup integrity verification failed."
}

$uri = [System.Uri]$TargetDbUrl
$hostName = $uri.Host

if ($TargetDbUrl -notmatch [regex]::Escape($ExpectedTargetProjectRef)) {
  Fail "Target DB URL does not contain the expected project ref '$ExpectedTargetProjectRef'."
}

# A restore target should be an explicitly separate environment.
# This cannot prove that the target is non-production, so require an explicit override
# for hosts that look like a live project endpoint.
if (-not $AllowProductionLikeHost) {
  if ($hostName -match "supabase\.co$" -or $hostName -match "pooler\.supabase\.com$") {
    Write-Warning "The target looks like a Supabase hosted database."
    Write-Warning "This script is intended for an isolated restore-test project."
    Write-Warning "Re-run with -AllowProductionLikeHost only after confirming the project ref is NOT production."
    exit 20
  }
}

$roles  = Join-Path $BackupDirectory "roles.sql"
$schema = Join-Path $BackupDirectory "schema.sql"
$data   = Join-Path $BackupDirectory "data.sql"

foreach($f in @($roles,$schema,$data)){
  if(-not (Test-Path $f)){ Fail "Required restore file missing: $f" }
}

Write-Host "============================================================"
Write-Host "RESTORE TARGET SAFETY CHECK"
Write-Host "Host: $hostName"
Write-Host "Expected project ref: $ExpectedTargetProjectRef"
Write-Host "Backup baseline: $($manifest.baseline)"
Write-Host "Backup created: $($manifest.created_at_local)"
Write-Host "============================================================"
Write-Host ""
Write-Host "This operation modifies the target database."
$confirmation = Read-Host "Type RESTORE-$ExpectedTargetProjectRef to continue"
if ($confirmation -ne "RESTORE-$ExpectedTargetProjectRef") {
  Fail "Restore cancelled."
}

Write-Host "[1/6] Restore roles"
& psql --single-transaction --variable ON_ERROR_STOP=1 --file $roles --dbname $TargetDbUrl
if ($LASTEXITCODE -ne 0){ Fail "roles restore failed" }

Write-Host "[2/6] Restore schema"
& psql --single-transaction --variable ON_ERROR_STOP=1 --file $schema --dbname $TargetDbUrl
if ($LASTEXITCODE -ne 0){ Fail "schema restore failed" }

Write-Host "[3/6] Restore data"
& psql --single-transaction --variable ON_ERROR_STOP=1 --file $data --dbname $TargetDbUrl
if ($LASTEXITCODE -ne 0){ Fail "data restore failed" }

Write-Host "[4/6] Verify expected baseline"
$verifySql = @"
select *
from public.verify_restore_baseline('$($manifest.baseline)');
"@
$verifySql | & psql --variable ON_ERROR_STOP=1 --dbname $TargetDbUrl
if ($LASTEXITCODE -ne 0){ Fail "restore baseline verification query failed" }

Write-Host "[5/6] Collect structural checks"
$structSql = @"
select
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as public_tables,
  (select count(*) from pg_policies where schemaname='public') as rls_policies,
  (select count(*) from information_schema.triggers where trigger_schema='public') as triggers,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f') as public_functions,
  (select count(*) from public.backup_restore_manifest where schema_name='public' and backup_required=true) as manifest_tables;
"@
$structSql | & psql --variable ON_ERROR_STOP=1 --dbname $TargetDbUrl
if ($LASTEXITCODE -ne 0){ Fail "structural verification failed" }

Write-Host "[6/6] Create restore result record"
$result = [ordered]@{
  restored_at_local = (Get-Date).ToString("o")
  target_host = $hostName
  expected_target_project_ref = $ExpectedTargetProjectRef
  backup_directory = (Resolve-Path $BackupDirectory).Path
  backup_baseline = $manifest.baseline
  backup_created_at_local = $manifest.created_at_local
  status = "RESTORE_COMMANDS_COMPLETED"
  next_required_step = "Review verify_restore_baseline output and perform application E2E before any production use."
}
$resultPath = Join-Path $BackupDirectory "restore-result.json"
$result | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $resultPath

Write-Host ""
Write-Host "Restore commands completed."
Write-Host "Result record: $resultPath"
Write-Host "Do NOT treat this as production-ready until baseline output and application E2E are reviewed."
