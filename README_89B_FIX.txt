Phase26N-89B-FIX
作成日時: 2026-08-19
基準main SHA: df9312237c114c37f1b09a686e88a6cc8aca3593

修正対象:
assets/js/supabase.js のみ

原因:
前回89Bでは employee-employment-contracts.js / CSS はmainへ投入済みだったが、
supabase.jsへローダーが反映されておらず、社員詳細からモジュールが呼ばれていなかった。

投入:
ZIP内の assets/js/supabase.js をGitHubの同じ場所へ上書き。

SQL:
追加実行なし。前回SQLは再実行しない。

投入後に行う確認:
1. GitHub PagesのDeployment完了を待つ。
2. 社員詳細画面を開いて Ctrl+F5。
3. 「社員書類」と「人事履歴」の間に「雇用・契約」が表示されること。
4. 表示されたら「契約を追加」を押し、登録画面が開くこと。
5. ここまでの結果を伝える。登録テストは画面表示確認後に続ける。

もし3で表示されない場合:
何度も投入し直さず、その画面のスクリーンショットを送る。
