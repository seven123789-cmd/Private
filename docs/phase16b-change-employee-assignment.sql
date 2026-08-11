-- Phase16-B: 社員所属・役職・等級変更の原子更新関数
-- 2026-08-11
--
-- 前提:
-- Phase15 / Phase16-A 正常完了
-- employees_total=98 / history_total=98 / mismatch=0
-- uq_employee_assignment_history_one_current 有効
--
-- 方針:
-- 1. employees を行ロック
-- 2. 現在履歴を取得
-- 3. 変更が無ければ何もしない
-- 4. 現在履歴を前日で閉じる
-- 5. 新しい履歴を作成
-- 6. employees の現在値を更新
-- 上記をDB関数1回のトランザクション内で実施する。
--
-- 注意:
-- grade_id は現状43名NULLのため、NULLを正規値として扱う。
-- 過去履歴の推測補完はしない。

begin;

create or replace function public.change_employee_assignment(
  p_employee_id uuid,
  p_effective_from date,
  p_center_id uuid,
  p_division_id uuid,
  p_position_id uuid,
  p_grade_id uuid,
  p_change_type text default 'other',
  p_memo text default null
)
returns public.employee_assignment_history
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_current public.employee_assignment_history%rowtype;
  v_new public.employee_assignment_history%rowtype;
begin
  if p_employee_id is null then
    raise exception 'employee_id is required';
  end if;

  if p_effective_from is null then
    raise exception 'effective_from is required';
  end if;

  if p_change_type not in
    ('hire','transfer','position_change','grade_change','correction','other') then
    raise exception 'invalid change_type: %', p_change_type;
  end if;

  -- 社員行をロック。並行更新を直列化する。
  select *
    into v_employee
  from public.employees
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'employee not found: %', p_employee_id;
  end if;

  -- 現在有効な履歴を取得。
  select *
    into v_current
  from public.employee_assignment_history
  where employee_id = p_employee_id
    and effective_to is null
  for update;

  if not found then
    raise exception 'current assignment history not found: %', p_employee_id;
  end if;

  -- 過去に遡って現在値を書き換える操作は禁止。
  if p_effective_from <= v_current.effective_from then
    raise exception
      'effective_from (%) must be later than current effective_from (%)',
      p_effective_from, v_current.effective_from;
  end if;

  -- 変更無しなら履歴を増やさない。
  if v_current.center_id is not distinct from p_center_id
     and v_current.division_id is not distinct from p_division_id
     and v_current.position_id is not distinct from p_position_id
     and v_current.grade_id is not distinct from p_grade_id then
    return v_current;
  end if;

  -- 参照先はFKでも検証されるが、NULLでない場合は分かりやすいエラーにする。
  if p_center_id is not null
     and not exists (select 1 from public.centers where id=p_center_id) then
    raise exception 'center not found: %', p_center_id;
  end if;

  if p_division_id is not null
     and not exists (select 1 from public.divisions where id=p_division_id) then
    raise exception 'division not found: %', p_division_id;
  end if;

  if p_position_id is not null
     and not exists (select 1 from public.positions where id=p_position_id) then
    raise exception 'position not found: %', p_position_id;
  end if;

  if p_grade_id is not null
     and not exists (select 1 from public.grades where id=p_grade_id) then
    raise exception 'grade not found: %', p_grade_id;
  end if;

  -- 旧履歴を変更日前日で閉じる。
  update public.employee_assignment_history
  set effective_to = p_effective_from - 1,
      updated_at = now()
  where id = v_current.id;

  -- 新履歴を作成。
  insert into public.employee_assignment_history (
    employee_id,
    center_id,
    division_id,
    position_id,
    grade_id,
    effective_from,
    effective_to,
    change_type,
    source,
    memo
  )
  values (
    p_employee_id,
    p_center_id,
    p_division_id,
    p_position_id,
    p_grade_id,
    p_effective_from,
    null,
    p_change_type,
    'change_employee_assignment',
    p_memo
  )
  returning * into v_new;

  -- 現在値を同期。
  update public.employees
  set center_id = p_center_id,
      division_id = p_division_id,
      position_id = p_position_id,
      grade_id = p_grade_id,
      updated_at = now()
  where id = p_employee_id;

  return v_new;
end;
$$;

revoke all on function public.change_employee_assignment(
  uuid,date,uuid,uuid,uuid,uuid,text,text
) from public;

grant execute on function public.change_employee_assignment(
  uuid,date,uuid,uuid,uuid,uuid,text,text
) to authenticated;

commit;

-- ===== 1回実行・1行確認 =====
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
  ) as mismatch_count;
