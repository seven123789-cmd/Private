-- Phase16-B 独立確認SQL
-- 2026-08-11
-- 1回実行・1行表示

select
  to_regprocedure(
    'public.change_employee_assignment(uuid,date,uuid,uuid,uuid,uuid,text,text)'
  ) is not null as function_exists,
  has_function_privilege(
    'authenticated',
    'public.change_employee_assignment(uuid,date,uuid,uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ) as authenticated_can_execute,
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
      on h.employee_id=e.id
     and h.effective_to is null
    where e.center_id is distinct from h.center_id
       or e.division_id is distinct from h.division_id
       or e.position_id is distinct from h.position_id
       or e.grade_id is distinct from h.grade_id
  ) as mismatch_count,
  (select count(*) from public.employees) as employees_total,
  (select count(*) from public.employee_assignment_history where effective_to is null)
    as current_history_total;
