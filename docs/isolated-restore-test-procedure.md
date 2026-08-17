# 別環境への復元テスト手順
更新日: 2026-08-17

## 原則

本番データベースへ直接リストアしない。
復元テストは、本番とは別に用意したSupabaseプロジェクトで行う。

このリポジトリに追加したスクリプトは、次の安全策を前提とする。

- BackupのSHA-256検証を復元前に必須化
- 復元対象Project Refを環境変数で明示
- DB URL内に指定Project Refが含まれるか確認
- Supabaseホストへの復元は明示Overrideなしでは停止
- 復元直前に `RESTORE-<PROJECT-REF>` の手入力を要求
- roles / schema / data を別段階で復元
- 各段階を `--single-transaction` + `ON_ERROR_STOP=1` で実行
- 復元後に `verify_restore_baseline()` を実行
- 復元結果を `restore-result.json` にローカル保存
- `restore-result.json` は本番データと同様にGitへコミットしない運用とする

## 1. 復元先の用意

本番とは別のSupabaseプロジェクトを用意する。

確認するもの:

- Project Ref
- Database password
- Session pooler接続文字列
- 本番ではないこと

## 2. 環境変数

PowerShell例:

```powershell
$env:SUPABASE_RESTORE_PROJECT_REF="復元テスト用Project Ref"
$env:SUPABASE_RESTORE_DB_URL="復元テスト用Session pooler接続文字列"
```

本番Project Refや本番接続URLを設定しない。

## 3. 事前確認のみ

```powershell
.\scripts\restore\restore-preflight.ps1 `
  -BackupDirectory ".\backups\integrated-master-YYYYMMDD-HHMMSS"
```

このスクリプトはDBを変更しない。

`project_ref_matches=True` を確認する。

## 4. 復元

```powershell
.\scripts\restore\restore-to-isolated-project.ps1 `
  -BackupDirectory ".\backups\integrated-master-YYYYMMDD-HHMMSS" `
  -AllowProductionLikeHost
```

Supabase hosted DBはホスト名だけでは本番/検証を区別できないため、Project Ref照合に加え `-AllowProductionLikeHost` を明示しないと停止する。

実行時にはさらに:

`RESTORE-<PROJECT-REF>`

の入力を要求する。

## 5. 復元後DB検証

バックアップManifestに保存されたBaseline名を使って、スクリプトが自動で:

```sql
select * from public.verify_restore_baseline('...baseline...');
```

を実行する。

以下が必要:

- NG = 0
- DIFF = 0
- CHECK = 0

加えて構造確認として:

- public table数
- RLS Policy数
- Trigger数
- public Function数
- Backup Manifest対象数

を表示する。

## 6. アプリE2E

復元した検証プロジェクトへアプリを接続して、最低限次を確認する。

1. ログイン
2. 社員一覧
3. 社員詳細
4. 正式人事履歴
5. 資格・免許
6. 事業所資格
7. アラート
8. データ運用確認
9. 監査ログ
10. CSV出力
11. 社員一括取込のプレビュー（本番社員マスターを変更しない）
12. `監査テスト` Probe

## 7. 完了条件

復元テストは次をすべて満たして完了とする。

- SHA-256一致
- Restoreコマンド成功
- Baseline NG/DIFF/CHECK = 0
- 重要FK孤児 = 0
- RLS/Trigger/RPCが存在
- アプリE2E正常
- `restore-result.json`保存
- 実施日・実施者・使用Backup世代を運用記録へ転記

## 8. 本番への切替

このスクリプトは「本番復元自動化」を目的としない。
本番障害時は、検証環境で復元確認したBackup世代と復旧方針を責任者が承認したうえで、本番用の個別復旧手順を作成する。

誤操作防止のため、通常運用で本番DBへの自動RestoreコマンドはGitHubへ用意しない。
