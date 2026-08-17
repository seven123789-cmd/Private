# 外部論理バックアップ実行手順
更新日: 2026-08-17

## 目的
GitHubには「取得手順と検証スクリプト」だけを保存し、本番データ・接続情報・バックアップ実体は保存しない。

## GitHubに置くもの
- `scripts/backup/create-logical-backup.ps1`
- `scripts/backup/verify-backup.ps1`
- `.env.example`
- `.gitignore`
- この手順書

## GitHubに置かないもの
- `roles.sql`
- `schema.sql`
- `data.sql`
- `.backup` / `.dump`
- `backup-manifest.json`
- SHA-256一覧
- 本番DB URL、パスワード、アクセストークン
- 社員・資格・人事履歴等の本番データ

`.gitignore` で代表的なバックアップファイルと `/backups/` を除外している。

## 取得
Windows PowerShell例:

```powershell
$env:SUPABASE_DB_URL="（Supabase DashboardのConnectから取得したSession pooler接続文字列）"
.\scripts\backup\create-logical-backup.ps1
```

生成先:
`backups/integrated-master-YYYYMMDD-HHMMSS/`

内容:
- `roles.sql`
- `schema.sql`
- `data.sql`
- `backup-checksums.sha256`
- `backup-manifest.json`

`backup-manifest.json` はPhase26L完了時の標準Baseline `baseline-20260817-phase26l-final` と基準Schema Versionを記録する。

## 破損確認
```powershell
.\scripts\backup\verify-backup.ps1 -BackupDirectory ".\backups\integrated-master-YYYYMMDD-HHMMSS"
```

全ファイルの存在とSHA-256が一致した場合のみ保管対象とする。

## 保管
生成物には個人情報を含むため、GitHubへpushしない。
会社承認済みの暗号化されたSupabase外保管先へ移す。

## 復元
復元は本番へ直接行わず、原則として別Supabaseプロジェクトで先に実施する。

Supabase公式のCLI手順に従い、roles → schema → data の順序を基本とする。
復元後はアプリを接続する前にDB構造・RLS・Functions・Triggersを確認する。

その後:
```sql
select * from public.verify_restore_baseline('baseline-20260817-phase26l-final');
```

NG / DIFF / CHECK が0であることを確認する。

注意: バックアップ取得後に正式なDB変更があれば、古いBaselineとの正当な差異が出る。差異を消す目的でBaselineを更新しない。

## Storage
このPowerShellはDatabaseの論理バックアップ用であり、Storageオブジェクト実体を含まない。
Storage利用開始後はS3互換クライアントまたはSupabase Storage API/CLI等を利用した別バックアップを同一世代で取得する。

## 公式仕様（2026-08-17確認）
- Supabase公式 Database Backups
- Supabase公式 Backup and Restore using the CLI
- Supabase公式 CLI `db dump`
- Supabase公式 Download Objects

公式手順ではCLIバックアップをroles/schema/dataに分けて取得できる。Database BackupはStorage APIのオブジェクト実体を含まない。
