-- Phase10 次段階候補（まだ実行しない）
-- 認証画面・セッション維持・権限確認が完成してから実施すること。

-- employees の anon SELECT を閉じる候補:
-- drop policy if exists "allow public read employees" on public.employees;

-- 実行前条件:
-- 1. ログイン画面完成
-- 2. 全業務画面でSupabase Authセッション確認
-- 3. authenticatedで必要画面が読書き可能
-- 4. ログアウト後に社員情報が取得不能であることを検証
