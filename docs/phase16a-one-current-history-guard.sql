-- Phase16-A: 履歴整合性ガード
-- 2026-08-11
-- Phase15最終確認が期待値一致した後に実行すること。
-- 目的: 1社員につき「現在有効な履歴(effective_to IS NULL)」を最大1件にDBで保証。
-- employeesの既存列・データは変更しない。

begin;

create unique index if not exists uq_employee_assignment_history_one_current
on public.employee_assignment_history(employee_id)
where effective_to is null;

commit;

-- 1回実行・1行表示
select
  exists (
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='employee_assignment_history'
      and indexname='uq_employee_assignment_history_one_current'
  ) as one_current_guard_enabled,
  (
    select count(*)
    from (
      select employee_id
      from public.employee_assignment_history
      where effective_to is null
      group by employee_id
      having count(*) > 1
    ) d
  ) as duplicate_active_employees;
