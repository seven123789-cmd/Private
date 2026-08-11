# Phase16-E 異動・人事情報変更UI
基準日: 2026-08-11

## 実装
社員詳細の「人事異動履歴」に「異動・人事情報を変更」を追加。
適用日・センター・部門・役職/職種・等級・メモを入力し、差分確認後に登録する。

## 安全設計
- 未来日の予約異動は登録不可（現在値が未来日で先に変わる事故を防止）
- 適用日は現在履歴の開始日より後のみ
- 変更無しは登録不可
- DB関数1回で旧履歴終了、新履歴作成、employees現在値を同期
- ID列だけでなく既存画面が使用中の center/division/position/current_grade 文字列も同一TXで同期
- admin/editor かつ is_active のAuthユーザーのみ変更可能
- viewerは変更不可
- grade未設定はNULLとして許容
- 既存 change_employee_assignment() は残し、画面はv2のみ利用

## 投入順
1. GitHubへZIP内ファイルをルートから上書き
2. Supabase SQL Editorで `docs/phase16e-db-functions.sql` を全文Run
3. 最終結果が以下なら正常
   - history_rpc_exists = true
   - master_rpc_exists = true
   - change_rpc_exists = true
   - authenticated_can_change = true
   - duplicate_active_employees = 0
   - mismatch_count = 0
4. 社員詳細を再読込
5. 履歴のセンター・部門・役職名称が表示されることを確認
6. 「異動・人事情報を変更」を開き、入力画面が表示されることを確認

## 注意
最初の確認では実社員の変更登録ボタンを押さなくてよい。
UI表示とDB関数導入を確認後、必要なら安全な実変更テストを行う。
