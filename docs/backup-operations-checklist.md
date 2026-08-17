# バックアップ・復旧 運用チェックシート
更新日: 2026-08-17

## 現在の通常運用（1人利用 / Supabase Free）
- [ ] データ運用確認画面で異常がない
- [ ] Natural Key未設定 0
- [ ] Restore Baselineに想定外DIFFがない
- [ ] 監査ログが表示できる
- [ ] 大規模変更前には必要に応じて論理Backupを取得する

## 大規模変更時
- [ ] 変更内容を確認
- [ ] 必要なら `create-logical-backup.ps1` で臨時Backup
- [ ] SHA-256確認
- [ ] 変更実施
- [ ] Schema Version更新
- [ ] POSTCHECK
- [ ] 正式変更の場合のみ新Baseline作成

## Supabase Dashboard
Freeプランの実際のBackup表示・利用可能機能はDashboardと当時の公式仕様で確認する。
PITRは現在の必須運用にしない。

## 将来、重要度が上がった場合
次のいずれかが発生したらBackup運用を再検討する。
- 複数人が更新する
- 添付ファイルをStorageへ大量保存する
- データ消失時の復旧時間要求が厳しくなる
- Supabaseプランを変更する
- 会社として正式システム運用に移行する

その時点で、定期外部Backup・PITR・別環境Restore試験等を有効化する。
