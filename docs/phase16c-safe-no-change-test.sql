-- Phase16-C: change_employee_assignment 安全動作試験
-- 2026-08-11
--
-- 本番社員データを一時的に変更するが、最後に必ず ROLLBACK する。
-- テスト対象は employee_code 昇順の先頭社員。
-- 現在値と同一内容で関数を呼び、「変更無しなら履歴を増やさない」ことを検証。
-- 実社員の所属・役職・等級は確定変更しない。

begin;

do $$
declare
  v_employee public.employees%rowtype;
  v_current public.employee_assignment_history%rowtype;
  v_result public.employee_assignment_history%rowtype;
  v_before_history bigint;
  v_after_history bigint;
begin
  select *
  into v_employee
  from public.employees
  order by employee_code
  limit 1;

  if not found then
    raise exception 'No employee found';
  end if;

  select *
  into v_current
  from public.employee_assignment_history
  where employee_id=v_employee.id
    and effective_to is null;

  if not found then
    raise exception 'Current history not found for employee %', v_employee.employee_code;
  end if;

  select count(*)
  into v_before_history
  from public.employee_assignment_history
  where employee_id=v_employee.id;

  -- 同一内容で呼び出す。
  -- 関数仕様上、履歴を増やさず現在履歴を返すこと。
  select *
  into v_result
  from public.change_employee_assignment(
    v_employee.id,
    v_current.effective_from + 1,
    v_employee.center_id,
    v_employee.division_id,
    v_employee.position_id,
    v_employee.grade_id,
    'other',
    'Phase16-C no-change rollback test'
  );

  select count(*)
  into v_after_history
  from public.employee_assignment_history
  where employee_id=v_employee.id;

  if v_before_history <> v_after_history then
    raise exception
      'No-change test failed. before=%, after=%',
      v_before_history, v_after_history;
  end if;
end $$;

-- テストトランザクション内での整合性を1行表示
select
  (select count(*) from public.employees) as employees_total,
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
  ) as mismatch_count,
  true as no_change_call_completed;

rollback;
