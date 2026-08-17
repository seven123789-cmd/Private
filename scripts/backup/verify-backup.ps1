param(
  [Parameter(Mandatory=$true)][string]$BackupDirectory
)
$ErrorActionPreference="Stop"
if (-not (Test-Path $BackupDirectory)) { throw "Backup directory not found: $BackupDirectory" }
$manifestPath=Join-Path $BackupDirectory "backup-manifest.json"
if (-not (Test-Path $manifestPath)) { throw "backup-manifest.json not found" }
$m=Get-Content $manifestPath -Raw | ConvertFrom-Json
$failed=@()
foreach($f in $m.files){
  $path=Join-Path $BackupDirectory $f.name
  if(-not (Test-Path $path)){ $failed += "$($f.name): missing"; continue }
  $actual=(Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant()
  if($actual -ne $f.sha256){ $failed += "$($f.name): SHA256 mismatch" }
}
if($failed.Count -gt 0){
  $failed | ForEach-Object { Write-Error $_ }
  throw "Backup integrity verification failed."
}
Write-Host "OK: all backup files exist and SHA-256 checksums match."
Write-Host "Baseline recorded: $($m.baseline)"
Write-Host "Storage objects included: $($m.storage_objects_included)"
