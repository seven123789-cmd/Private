# Phase16-B 実行手順

基準日: 2026-08-11

## 結論
社員の異動・役職変更・等級変更を、DB関数1回で安全に処理する基盤を追加する。

## GitHub投入先
ZIPを展開し、リポジトリルートへそのままアップロードする。

- docs/phase16b-change-employee-assignment.sql
- docs/phase16b-verification.sql
- docs/phase16b-guide.md

## Supabaseで実行
`docs/phase16b-change-employee-assignment.sql` を全文コピーして Run。

最後のResultsは1行のみ。

正常値:
- function_exists = true
- authenticated_can_execute = true
- duplicate_active_employees = 0
- mismatch_count = 0

## この時点では実社員の異動テストをしない
98人の本番データを使ったダミー異動は行わない。
関数の存在・権限・既存データ整合性だけ確認する。

## 関数が保証すること
- 社員行をロックし並行更新を防止
- 現在履歴が無ければ停止
- 同じ内容なら履歴を増やさない
- 変更日が現在履歴開始日以前なら停止
- 旧履歴を変更日前日で終了
- 新履歴を追加
- employeesの現在値を同時更新
- 途中で1つでも失敗すれば処理全体をロールバック
- grade_id NULLを許容し、43名を推測補完しない

## 次
Phase16-Cでは「履歴を壊さずに安全にテストする検証用トランザクション」を作成。
その後、社員詳細画面から異動・役職変更・等級変更を操作できるUI/API層へ接続する。
