-- Phase16-C ロールバック後確認
-- Phase16-C本体実行後、これを実行する。
-- 1回実行・1行表示。

select
  (select count(*) from public.employees) as employees_total,
  (select count(*) from public.employee_assignment_history) as history_total,
  (select count(*) from public.employee_assignment_history where effective_to is null) as current_history_total,
  (
    select count(*)
    from (
      select employee_id
      from public.employee_assignment_history
      where effective_to is null
      group by employee_id
      having count(*) > 1
    ) d
  ) as duplicate_active_employees,
  (
    select count(*)
    from public.employees e
    join public.employee_assignment_history h
      on h.employee_id=e.id and h.effective_to is null
    where e.center_id is distinct from h.center_id
       or e.division_id is distinct from h.division_id
       or e.position_id is distinct from h.position_id
       or e.grade_id is distinct from h.grade_id
  ) as mismatch_count;
