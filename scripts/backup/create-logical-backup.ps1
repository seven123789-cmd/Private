param(
  [Parameter(Mandatory=$false)][string]$DbUrl = $env:SUPABASE_DB_URL,
  [Parameter(Mandatory=$false)][string]$OutputRoot = ".\backups"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbUrl)) {
  throw "SUPABASE_DB_URL is not set. Set it in the environment or pass -DbUrl. Do not save credentials in Git."
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI was not found."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dir = Join-Path $OutputRoot "integrated-master-$stamp"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$roles  = Join-Path $dir "roles.sql"
$schema = Join-Path $dir "schema.sql"
$data   = Join-Path $dir "data.sql"

Write-Host "[1/5] Dump roles"
& supabase db dump --db-url $DbUrl -f $roles --role-only
if ($LASTEXITCODE -ne 0) { throw "roles dump failed" }

Write-Host "[2/5] Dump schema"
& supabase db dump --db-url $DbUrl -f $schema
if ($LASTEXITCODE -ne 0) { throw "schema dump failed" }

Write-Host "[3/5] Dump data"
& supabase db dump --db-url $DbUrl -f $data --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
if ($LASTEXITCODE -ne 0) { throw "data dump failed" }

Write-Host "[4/5] Create SHA-256 checksums"
$files = @($roles,$schema,$data)
$checksums = foreach ($f in $files) {
  $h = Get-FileHash -Algorithm SHA256 -Path $f
  "{0}  {1}" -f $h.Hash.ToLowerInvariant(), (Split-Path $f -Leaf)
}
$checksumPath = Join-Path $dir "backup-checksums.sha256"
$checksums | Set-Content -Encoding ascii $checksumPath

Write-Host "[5/5] Create local manifest"
$manifest = [ordered]@{
  backup_format = "supabase-cli-logical-v1"
  created_at_local = (Get-Date).ToString("o")
  baseline = "baseline-20260817-phase26l-final"
  schema_version_at_phase26l_close = "2026.08.17-phase26l-124"
  files = @(
    @{ name="roles.sql";  sha256=(Get-FileHash -Algorithm SHA256 $roles).Hash.ToLowerInvariant(); bytes=(Get-Item $roles).Length },
    @{ name="schema.sql"; sha256=(Get-FileHash -Algorithm SHA256 $schema).Hash.ToLowerInvariant(); bytes=(Get-Item $schema).Length },
    @{ name="data.sql";   sha256=(Get-FileHash -Algorithm SHA256 $data).Hash.ToLowerInvariant(); bytes=(Get-Item $data).Length }
  )
  contains_personal_data = $true
  git_commit_allowed = $false
  storage_objects_included = $false
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $dir "backup-manifest.json")

Write-Host ""
Write-Host "Backup completed: $dir"
Write-Host "IMPORTANT: Move this directory to the approved encrypted off-site backup location. Do not commit it to Git."
