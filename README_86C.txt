Phase26N-86C

確認済み原因:
- assets/js/common.js は `const APP = ...`。
- common.js末尾では window.Auth / window.renderSidebar 等は公開するが window.APP = APP は存在しない。
- 86A/86Bの employee-license-documents.js は `if (!window.APP ...) return;` のため必ず停止していた。

投入:
- assets/js/documents.js 置換
- assets/js/employee-license-documents.js 置換

確認:
1. GitHubへ投入
2. Pages反映後、社員詳細をCtrl+F5
3. 資格・免許一覧の右端に「証明書」列と「書類管理」が表示されること
4. 「書類管理」で対象資格名のダイアログが開くこと
