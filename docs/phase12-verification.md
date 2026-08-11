# Phase12 認証必須化 検証手順
確認基準日: 2026-08-11

1. Phase12 ZIPをGitHubへ投入する。
2. 現在ログイン済みなら一度サイドバーからログアウトする。
3. index.html 等の業務ページURLを直接開く。
4. login.html に自動遷移することを確認する。
5. 管理者アカウントでログインする。
6. 総覧、社員一覧、資格台帳、社員取込、データ運用確認を開き、正常表示を確認する。
7. Supabase Authentication > Users の Last sign in at が更新されることを確認する。
8. ここまで成功後、phase12-lockdown.sql をSQL Editorで実行する。
9. ログアウト後、社員情報を閲覧できないことを確認する。

注意:
- phase12-lockdown.sql はコード側のログイン必須化確認より先に実行しない。
- service_role key はブラウザ側へ置かない。
