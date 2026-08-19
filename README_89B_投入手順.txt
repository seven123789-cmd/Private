Phase26N-89B
基準main SHA: bd531762d1ee1bfface97bede3e4f317843e26b0

重要:
SQLとGitHub投入ファイルは別です。

GitHub投入:
1. assets/js/employee-employment-contracts.js を新規追加
2. assets/css/employee-employment-contracts.css を新規追加
3. SUPABASE_JS_末尾追記.txt の内容を、既存 assets/js/supabase.js の末尾へ追記
   ※ supabase.js 全置換は禁止。既存コードを残したまま末尾追記。

Supabase:
Phase26N-89B_document_links_employment_contract.sql を別途SQL Editorで実行。

投入後確認:
1. SQL実行後、確認SELECTで employee_employment_contract が4つ目の許可値として表示される
2. GitHubへ投入しPages反映後、社員詳細をCtrl+F5
3. 人事履歴の上に「雇用・契約」カードが表示される
4. 「契約を追加」から契約区分・開始日・有期/無期・終了日・更新状況・備考を登録
5. 登録後、一覧へ即時反映される
6. 編集ができる
7. 「書類管理」から契約単位でPDF/画像を登録できる
8. 開く・保存・削除が動く
9. 契約書類が残っている契約は契約自体を削除できない
10. 契約書類を全削除後は契約を削除できる
11. 資格書類・人事履歴書類・社員共通書類が従来どおり動く

結果を伝える際は、1～11のどこで問題が出たかを教えてください。
