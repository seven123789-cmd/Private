Phase26N-86A

基準main SHA:
0bf15774551853c5cd7afc1265de68857ddd7dbc

投入:
- assets/js/documents.js 置換
- assets/js/supabase.js 置換
- assets/js/employee-license-documents.js 新規

確認:
1. GitHubへ投入しPages反映後、社員詳細をCtrl+F5
2. 資格・免許一覧の右端に「証明書」列 / 「書類管理」が出ること
3. 任意の資格で「書類管理」を押す
4. 「資格・免許の証明書」画面が開き、その資格名が表示されること
5. 書類追加でPDF/画像を登録
6. 開く / 保存 / 無効化が動くこと
7. 社員全体の「添付書類」カードには資格単位の証明書が混ざらないこと

CHANGELOG_86A_APPEND.txt は既存CHANGELOG.txt末尾への追記内容です。
