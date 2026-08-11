# Phase11 認証有効化手順
基準日: 2026-08-11

## 今回の状態
- Supabase Auth ログイン画面を追加。
- 全業務ページで Supabase JS SDK を読み込む。
- サイドバーにログイン状態を表示。
- AUTH_REQUIRED=false で互換運用を開始。
- 未認証でも従来画面は止めない。
- 認証済みの場合はDB一括取込など書込系でセッションを利用できる。

## 本番でログイン必須にする前の手順
1. Supabase Dashboard > Authentication > Users で最初の管理者ユーザーを作成。
2. login.html からメールアドレス・パスワードでログインできることを確認。
3. 社員管理・資格管理・ダッシュボード・社員取込がログイン状態で正常表示されることを確認。
4. assets/js/supabase.js の `window.AUTH_REQUIRED = false;` を `true` に変更。
5. ログアウト状態で業務ページが login.html へ遷移することを確認。
6. その後で `phase11-lockdown.sql` を実行して employees の anon SELECT を削除する。

## 注意
ログイン確認前に anon SELECT を削除しない。
管理者アカウントを最低1つ確認する前に AUTH_REQUIRED=true にしない。
