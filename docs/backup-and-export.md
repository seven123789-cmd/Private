# バックアップ・出力方針
基準日: 2026-08-16

- 正本は Supabase/PostgreSQL。CSVは業務交換用で完全バックアップの代替にしない。
- DB内部: schema_versions / backup_restore_manifest / restore_verification_snapshots / verify_restore_baseline() を使用する。
- Supabase管理側のBackup/PITRと、Supabase外の論理バックアップを併用する。
- 復元後は verify_restore_baseline('baseline-20260816-phase26i') で業務テーブル件数・主要FK孤児・Schema Versionを検証する。
- Storage導入後はDBメタデータとStorage実体を同一世代で保全する。
- 個人情報を含むため、外部バックアップの保管先・アクセス権・保持期間を会社ルールで定義する。
- CSVは UTF-8 BOM + CRLF。社員連携は employee_code を安定キーとする。


## Phase26L 運用画面
更新日: 2026-08-17

- `data_operations.html` で DBスキーマ版、Backup Manifest、Natural Key未設定、復元基準、復元整合、監査ログ件数、社員取込バッチ件数を確認する。
- `audit_log` は画面で直近200件を参照し、UTF-8 BOM / CRLF のCSVとして出力できる。
- 監査CSVは業務確認用であり、完全バックアップではない。
- ブラウザ画面からDB全体の復元や完全ダンプは実行しない。誤操作・権限集中を避けるため、完全バックアップ/復元はSupabase管理側または管理者用論理バックアップ手順で行う。
- Supabase管理側のBackup/PITRの有効状態・保持日数、Supabase外バックアップの実在・暗号化・アクセス権・保持期間はDB内SQLだけでは確認できないため、別途運用確認する。
- `backup_restore_manifest.natural_key_hint` は移行・重複判定の補助情報。実復元ではPK/FKとSchema Versionを保持し、復元後に `verify_restore_baseline()` を必ず実行する。

- 2026-08-17: 運用画面の復元検証基準を `baseline-20260817-phase26l` へ更新。業務差異と基盤差異を分離表示。authenticated専用 `audit_e2e_probe()` により業務データを変更せず監査表示/CSV経路を検証する。

- 2026-08-17 Phase26L final: 復元検証の標準参照先を `baseline-20260817-phase26l-final` に確定。
  POSTCHECK実測: Manifest 29表 / Baseline 29表 / NG 0 / DIFF 0 / CHECK 0 / 監査E2E Probe 1件保持 / Schema Version `2026.08.17-phase26l-124`。
  監査Probeは検証証跡として削除しない。
