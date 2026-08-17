param(
 [Parameter(Mandatory=$false)][string]$BackupRoot=".\backups",
 [Parameter(Mandatory=$false)][int]$KeepWeekly=8,
 [Parameter(Mandatory=$false)][int]$KeepMonthly=24,
 [Parameter(Mandatory=$false)][int]$KeepYearly=10,
 [Parameter(Mandatory=$false)][switch]$Apply
)
$ErrorActionPreference="Stop"
if(-not(Test-Path $BackupRoot)){ throw "Backup root not found: $BackupRoot" }

$dirs=Get-ChildItem $BackupRoot -Directory | ForEach-Object {
 $m=Join-Path $_.FullName "backup-manifest.json"
 if(Test-Path $m){
   try{
    $j=Get-Content $m -Raw | ConvertFrom-Json
    [pscustomobject]@{Dir=$_; Created=[datetimeoffset]$j.created_at_local; Manifest=$j}
   }catch{}
 }
} | Sort-Object Created -Descending

$keep=New-Object 'System.Collections.Generic.HashSet[string]'
# Always keep newest valid generation.
if($dirs.Count -gt 0){ [void]$keep.Add($dirs[0].Dir.FullName) }

$weekly=$dirs | Group-Object { "{0:yyyy}-{1:D2}" -f $_.Created.DateTime,
 [System.Globalization.ISOWeek]::GetWeekOfYear($_.Created.DateTime) } |
 ForEach-Object {$_.Group|Sort-Object Created -Descending|Select-Object -First 1} |
 Sort-Object Created -Descending | Select-Object -First $KeepWeekly
$monthly=$dirs | Group-Object {$_.Created.ToString("yyyy-MM")} |
 ForEach-Object {$_.Group|Sort-Object Created -Descending|Select-Object -First 1} |
 Sort-Object Created -Descending | Select-Object -First $KeepMonthly
$yearly=$dirs | Group-Object {$_.Created.ToString("yyyy")} |
 ForEach-Object {$_.Group|Sort-Object Created -Descending|Select-Object -First 1} |
 Sort-Object Created -Descending | Select-Object -First $KeepYearly
@($weekly)+@($monthly)+@($yearly) | ForEach-Object { if($_){[void]$keep.Add($_.Dir.FullName)} }

$plan=$dirs|ForEach-Object{
 [pscustomobject]@{
  Created=$_.Created
  Directory=$_.Dir.Name
  Action=if($keep.Contains($_.Dir.FullName)){"KEEP"}else{"DELETE_CANDIDATE"}
 }
}
$plan|Format-Table -AutoSize

if(-not $Apply){
 Write-Host ""
 Write-Host "DRY RUN ONLY. Nothing was deleted. Re-run with -Apply only after reviewing the list."
 exit 0
}
$confirm=Read-Host "Type DELETE-OLD-BACKUPS to delete candidates"
if($confirm -ne "DELETE-OLD-BACKUPS"){ throw "Cancelled." }
$plan|Where-Object Action -eq "DELETE_CANDIDATE"|ForEach-Object{
 Remove-Item -LiteralPath (Join-Path $BackupRoot $_.Directory) -Recurse -Force
}
Write-Host "Retention applied."
