-- Phase15 最終確認（1回実行・1行表示）
-- 2026-08-11
select
  (select count(*) from public.employees) as employees_total,
  (select count(*) from public.employee_assignment_history) as history_total,
  (select count(distinct employee_id) from public.employee_assignment_history) as employees_with_history,
  (
    select count(*)
    from public.employees e
    join public.employee_assignment_history h
      on h.employee_id=e.id and h.effective_to is null
    where e.center_id is distinct from h.center_id
       or e.division_id is distinct from h.division_id
       or e.position_id is distinct from h.position_id
       or e.grade_id is distinct from h.grade_id
  ) as mismatch_count,
  (
    select count(*)
    from (
      select employee_id
      from public.employee_assignment_history
      where effective_to is null
      group by employee_id
      having count(*) > 1
    ) x
  ) as duplicate_active_employees,
  (
    select count(*)
    from public.employee_assignment_history
    where grade_id is null
  ) as history_grade_id_missing;
