# DBロードマップ
基準日: 2026-08-16

## 完了
employee_code UNIQUE、履歴正規化、重複防止、PK/FK/INDEX、RLS/RPC、SECURITY DEFINER保護、updated_at、schema_versions、backup_restore_manifest、restore_verification_snapshots、verify_restore_baseline()。

## 次期優先
1. created_by / updated_by
2. audit_logまたは業務別変更履歴
3. 社員一括取込のDBトランザクション化と取込監査
4. Supabase Backup/PITR運用確認
5. Supabase外バックアップの世代管理と定期復元テスト
6. Storage導入時の同世代バックアップ

## 原則
現在値と履歴を分離し、取込は安定キーで照合する。推測履歴は作らない。完全バックアップはDBダンプを正とする。
