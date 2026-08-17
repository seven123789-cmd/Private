# バックアップ・復旧 運用チェックシート
更新日: 2026-08-17

## A. Supabase管理側（初回・契約変更時）
- [ ] 現在のプランを確認
- [ ] Database > Backups で自動バックアップが存在する
- [ ] 直近バックアップ成功日時を確認
- [ ] 保持期間を記録
- [ ] PITRの有効/無効を記録
- [ ] PITR有効時は最古/最新Recovery Pointを確認
- [ ] 復旧操作ができる管理者を2名以上決める
- [ ] Storage利用の有無を記録

## B. 外部論理バックアップ（毎週推奨）
- [ ] `create-logical-backup.ps1` 成功
- [ ] roles.sqlあり
- [ ] schema.sqlあり
- [ ] data.sqlあり
- [ ] backup-manifest.jsonあり
- [ ] SHA-256検証OK
- [ ] GitHub外の承認済み暗号化保管先へ移動
- [ ] 世代名と取得日を記録

## C. 世代管理（月1回）
- [ ] `retention-plan.ps1` をまずDry Run
- [ ] 削除候補を人が確認
- [ ] 最新世代がKEEP
- [ ] 月次・年次世代がKEEP
- [ ] 承認後のみ `-Apply`
- [ ] 削除実績を記録

標準案: 週次8世代 / 月次24世代 / 年次10世代。
会社の情報セキュリティ・個人情報保護・法定保存要件が優先。

## D. 四半期復元テスト
- [ ] 本番とは別Project Ref
- [ ] Backup SHA-256一致
- [ ] `restore-preflight.ps1` OK
- [ ] Project Ref照合OK
- [ ] roles/schema/data復元成功
- [ ] Baseline NG=0
- [ ] Baseline DIFF=0
- [ ] Baseline CHECK=0
- [ ] RLS/Trigger/RPC確認
- [ ] アプリE2E確認
- [ ] restore-result.json保存
- [ ] 実施者/確認者/使用世代を記録

## E. Storage利用開始時
- [ ] DBバックアップだけではStorageオブジェクト実体が保全されないことを確認
- [ ] Storageオブジェクトの外部バックアップ方式を追加
- [ ] Bucket/Policy/オブジェクトを同一世代として管理
- [ ] Storage復元テストを追加

## F. 大規模変更前後
- [ ] 変更前臨時Backup
- [ ] SHA-256 OK
- [ ] 変更実施
- [ ] Schema Version更新
- [ ] POSTCHECK
- [ ] 正式変更の場合のみ新Baseline作成
- [ ] 変更後Backup
