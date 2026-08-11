-- Phase16-E: 人事異動UI用DB関数
-- 2026-08-11
--
-- 目的
-- 1) 履歴表示のマスタ名称をDB側JOINで確実に取得
-- 2) 異動入力用マスタを認証済みユーザーへ提供
-- 3) 履歴・employees ID列・互換文字列列を1トランザクションで同期
--
-- Phase13 user_profiles の is_active / role を書込権限制御に利用する。
-- 既存 change_employee_assignment() は残し、画面は v2 のみ利用する。

begin;

create or replace function public.get_employee_assignment_history_v2(
  p_employee_id uuid
)
returns table (
  id uuid,
  employee_id uuid,
  center_id uuid,
  division_id uuid,
  position_id uuid,
  grade_id uuid,
  effective_from date,
  effective_to date,
  change_type text,
  source text,
  memo text,
  created_at timestamptz,
  updated_at timestamptz,
  center_name text,
  division_name text,
  position_name text,
  grade_name text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    h.id, h.employee_id, h.center_id, h.division_id, h.position_id, h.grade_id,
    h.effective_from, h.effective_to, h.change_type, h.source, h.memo,
    h.created_at, h.updated_at,
    c.center_name::text,
    d.division_name::text,
    p.position_name::text,
    coalesce(g.grade_name::text,'未設定') as grade_name
  from public.employee_assignment_history h
  left join public.centers c on c.id=h.center_id
  left join public.divisions d on d.id=h.division_id
  left join public.positions p on p.id=h.position_id
  left join public.grades g on g.id=h.grade_id
  where auth.uid() is not null
    and h.employee_id=p_employee_id
  order by h.effective_from desc, h.created_at desc;
$$;

create or replace function public.get_assignment_master_options()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'centers', coalesce((select jsonb_agg(jsonb_build_object('id',id,'center_name',center_name) order by center_name) from public.centers),'[]'::jsonb),
    'divisions', coalesce((select jsonb_agg(jsonb_build_object('id',id,'division_name',division_name) order by division_name) from public.divisions),'[]'::jsonb),
    'positions', coalesce((select jsonb_agg(jsonb_build_object('id',id,'position_name',position_name) order by position_name) from public.positions),'[]'::jsonb),
    'grades', coalesce((select jsonb_agg(jsonb_build_object('id',id,'grade_name',grade_name) order by grade_name) from public.grades),'[]'::jsonb)
  ) end;
$$;

create or replace function public.change_employee_assignment_v2(
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
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_current public.employee_assignment_history%rowtype;
  v_new public.employee_assignment_history%rowtype;
  v_center_name text;
  v_division_name text;
  v_position_name text;
  v_grade_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.user_id=auth.uid()
      and up.is_active=true
      and up.role in ('admin','editor')
  ) then
    raise exception 'assignment change permission denied';
  end if;

  if p_employee_id is null or p_effective_from is null then
    raise exception 'employee_id and effective_from are required';
  end if;

  if p_effective_from > (now() at time zone 'Asia/Tokyo')::date then
    raise exception 'future effective date is not supported';
  end if;

  if p_change_type not in ('hire','transfer','position_change','grade_change','correction','other') then
    raise exception 'invalid change_type: %',p_change_type;
  end if;

  select * into v_employee
  from public.employees
  where employees.id=p_employee_id
  for update;

  if not found then raise exception 'employee not found: %',p_employee_id; end if;

  select * into v_current
  from public.employee_assignment_history
  where employee_id=p_employee_id and effective_to is null
  for update;

  if not found then raise exception 'current assignment history not found: %',p_employee_id; end if;

  if p_effective_from <= v_current.effective_from then
    raise exception 'effective_from (%) must be later than current effective_from (%)',
      p_effective_from,v_current.effective_from;
  end if;

  if v_current.center_id is not distinct from p_center_id
     and v_current.division_id is not distinct from p_division_id
     and v_current.position_id is not distinct from p_position_id
     and v_current.grade_id is not distinct from p_grade_id then
    return v_current;
  end if;

  select center_name::text into v_center_name from public.centers where id=p_center_id;
  if v_center_name is null then raise exception 'center not found: %',p_center_id; end if;

  select division_name::text into v_division_name from public.divisions where id=p_division_id;
  if v_division_name is null then raise exception 'division not found: %',p_division_id; end if;

  select position_name::text into v_position_name from public.positions where id=p_position_id;
  if v_position_name is null then raise exception 'position not found: %',p_position_id; end if;

  if p_grade_id is not null then
    select grade_name::text into v_grade_name from public.grades where id=p_grade_id;
    if v_grade_name is null then raise exception 'grade not found: %',p_grade_id; end if;
  else
    v_grade_name := null;
  end if;

  update public.employee_assignment_history
  set effective_to=p_effective_from-1,
      updated_at=now()
  where id=v_current.id;

  insert into public.employee_assignment_history (
    employee_id,center_id,division_id,position_id,grade_id,
    effective_from,effective_to,change_type,source,memo
  ) values (
    p_employee_id,p_center_id,p_division_id,p_position_id,p_grade_id,
    p_effective_from,null,p_change_type,'change_employee_assignment_v2',p_memo
  )
  returning * into v_new;

  -- ID列を正本として更新しつつ、現行画面互換用の文字列列も同一TXで同期。
  update public.employees
  set center_id=p_center_id,
      division_id=p_division_id,
      position_id=p_position_id,
      grade_id=p_grade_id,
      center=v_center_name,
      division=v_division_name,
      position=v_position_name,
      current_grade=v_grade_name,
      updated_at=now()
  where id=p_employee_id;

  return v_new;
end;
$$;

revoke all on function public.get_employee_assignment_history_v2(uuid) from public;
revoke all on function public.get_assignment_master_options() from public;
revoke all on function public.change_employee_assignment_v2(uuid,date,uuid,uuid,uuid,uuid,text,text) from public;

grant execute on function public.get_employee_assignment_history_v2(uuid) to authenticated;
grant execute on function public.get_assignment_master_options() to authenticated;
grant execute on function public.change_employee_assignment_v2(uuid,date,uuid,uuid,uuid,uuid,text,text) to authenticated;

commit;

-- 1回実行・1行確認
select
  to_regprocedure('public.get_employee_assignment_history_v2(uuid)') is not null as history_rpc_exists,
  to_regprocedure('public.get_assignment_master_options()') is not null as master_rpc_exists,
  to_regprocedure('public.change_employee_assignment_v2(uuid,date,uuid,uuid,uuid,uuid,text,text)') is not null as change_rpc_exists,
  has_function_privilege('authenticated','public.change_employee_assignment_v2(uuid,date,uuid,uuid,uuid,uuid,text,text)','EXECUTE') as authenticated_can_change,
  (
    select count(*) from (
      select employee_id
      from public.employee_assignment_history
      where effective_to is null
      group by employee_id
      having count(*)>1
    ) x
  ) as duplicate_active_employees,
  (
    select count(*)
    from public.employees e
    join public.employee_assignment_history h on h.employee_id=e.id and h.effective_to is null
    where e.center_id is distinct from h.center_id
       or e.division_id is distinct from h.division_id
       or e.position_id is distinct from h.position_id
       or e.grade_id is distinct from h.grade_id
  ) as mismatch_count;
