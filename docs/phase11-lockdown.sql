-- Phase11 認証強制後に実行するSQL
-- まだ実行しないでください。
-- 前提: login.html で authenticated セッションの動作確認済み。

begin;

drop policy if exists "allow public read employees" on public.employees;

commit;

-- 実行後確認
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='employees'
order by policyname;
