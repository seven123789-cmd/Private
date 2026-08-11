-- Phase12 最終ロックダウン
-- 実行タイミング:
-- Phase12 ZIP投入後、ログアウト状態で業務ページ→login.htmlへの遷移を確認し、
-- 再ログイン後に各画面が正常表示されることを確認してから実行する。

begin;

drop policy if exists "allow public read employees" on public.employees;

commit;

-- 確認: employees は authenticated 用ポリシーのみ残ること
select
  schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and tablename='employees'
order by policyname;
