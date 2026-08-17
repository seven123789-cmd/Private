# Phase26M 長期バックアップ・災害復旧 状態
基準日: 2026-08-17

## 完了
- DB内部 Backup Manifest: 29表
- Natural Key未設定: 0
- Restore Baseline: baseline-20260817-phase26l-final
- Phase26L POSTCHECK: NG0 / DIFF0 / CHECK0
- Audit E2E: 成功、Probe 1件保持
- 外部論理Backupスクリプト
- SHA-256検証
- Gitへの本番Backup/秘密情報混入防止
- 別環境Restore preflight
- Project Ref照合・明示確認
- Restore後Baseline/構造検証
- 世代管理Dry Run/明示削除
- 復元テスト履歴様式
- 運用チェックシート

## 外部確認が必要で未完了
- 本番Supabaseプラン
- Dashboard上の直近自動Backup
- 実際の保持期間
- PITR有効/無効
- PITR Recovery Window
- Supabase外の会社承認済み暗号化保管先
- 復旧管理者/承認者
- 別Supabase Projectを使った実Restoreテスト
- Storage利用開始後のオブジェクトバックアップ

これらはコードやDB内部SQLだけでは確認できないため、運用開始前の管理項目として残す。
