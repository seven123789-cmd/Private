# バックアップ・出力方針
基準日: 2026-08-16

- 正本は Supabase/PostgreSQL。CSVは業務交換用で完全バックアップの代替にしない。
- DB内部: schema_versions / backup_restore_manifest / restore_verification_snapshots / verify_restore_baseline() を使用する。
- Supabase管理側のBackup/PITRと、Supabase外の論理バックアップを併用する。
- 復元後は verify_restore_baseline('baseline-20260816-phase26i') で業務テーブル件数・主要FK孤児・Schema Versionを検証する。
- Storage導入後はDBメタデータとStorage実体を同一世代で保全する。
- 個人情報を含むため、外部バックアップの保管先・アクセス権・保持期間を会社ルールで定義する。
- CSVは UTF-8 BOM + CRLF。社員連携は employee_code を安定キーとする。
