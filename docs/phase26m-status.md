# Phase26M 長期バックアップ・災害復旧 状態
基準日: 2026-08-17

## 運用前提
- 実運用者・管理者は1名
- 他者の入力・更新は想定しない
- 閲覧のみ1～2名程度の可能性
- Supabase Freeを使用
- 通常保存先はSupabaseのみ
- 外部バックアップ保管先は現時点では必須化しない
- PITRは現在の必須要件にしない

## 完了
- DB内部 Backup Manifest: 29表
- Natural Key未設定: 0
- Restore Baseline: baseline-20260817-phase26l-final
- Phase26L POSTCHECK: NG0 / DIFF0 / CHECK0
- Audit E2E: 成功
- 論理Backup取得手段を将来/臨時用として保持
- SHA-256検証
- Gitへの本番Backup/秘密情報混入防止
- 別環境Restore preflight
- Project Ref照合・明示確認
- Restore後Baseline/構造検証
- 世代管理スクリプト（必要時利用）
- 復元テスト履歴様式

## 現在必須ではないもの
- 定期的なSupabase外バックアップ
- 複数管理者/復旧承認者
- 有料PITR
- 外部Storageサービス
- 定期的な別Project Restore試験

## 必要時に利用できるよう保持するもの
- `scripts/backup/`
- `scripts/restore/`
- 災害復旧Runbook
- 外部論理Backup手順

将来、データ重要度・利用者・契約プランが変わった場合に再設計せず利用できるよう残す。
