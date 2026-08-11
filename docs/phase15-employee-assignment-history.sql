-- Phase15: 社員所属・役職・等級 履歴基盤
-- 2026-08-11
-- 前提実測: employees 98件 / center_id欠損0 / division_id欠損0 /
-- position_id欠損0 / grade_id欠損43
-- 方針: 既存employeesは変更・削除せず、履歴テーブルを追加して初期履歴を安全に作る。

begin;

create table if not exists public.employee_assignment_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  center_id uuid references public.centers(id) on delete restrict,
  division_id uuid references public.divisions(id) on delete restrict,
  position_id uuid references public.positions(id) on delete restrict,
  grade_id uuid references public.grades(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  change_type text not null default 'initial'
    check (change_type in ('initial','hire','transfer','position_change','grade_change','correction','other')),
  source text not null default 'system',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_assignment_history_period_check
    check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_employee_assignment_history_employee
  on public.employee_assignment_history(employee_id);

create index if not exists idx_employee_assignment_history_period
  on public.employee_assignment_history(employee_id, effective_from desc);

-- 同一社員の同一起算日を重複登録しない。
create unique index if not exists uq_employee_assignment_history_employee_from
  on public.employee_assignment_history(employee_id, effective_from);

alter table public.employee_assignment_history enable row level security;

drop policy if exists "employee_assignment_history_authenticated_all"
  on public.employee_assignment_history;

create policy "employee_assignment_history_authenticated_all"
on public.employee_assignment_history
for all
to authenticated
using (true)
with check (true);

-- 初期履歴:
-- join_dateがあれば入社日、無ければ本基盤導入日を起算日とする。
-- grade_id未設定43件はNULLのまま正しく保持し、推測補完しない。
insert into public.employee_assignment_history (
  employee_id, center_id, division_id, position_id, grade_id,
  effective_from, effective_to, change_type, source, memo
)
select
  e.id,
  e.center_id,
  e.division_id,
  e.position_id,
  e.grade_id,
  coalesce(e.join_date, date '2026-08-11'),
  null,
  'initial',
  'phase15_backfill',
  case
    when e.join_date is null then '初期履歴。入社日未設定のため基盤導入日を起算日として登録。'
    else '初期履歴。Phase15導入時点のemployees現在値から登録。'
  end
from public.employees e
where not exists (
  select 1
  from public.employee_assignment_history h
  where h.employee_id=e.id
);

commit;

-- ===== Verification =====

-- A. 件数
select
  (select count(*) from public.employees) as employees_total,
  (select count(*) from public.employee_assignment_history) as history_total,
  (select count(distinct employee_id) from public.employee_assignment_history) as employees_with_history;

-- B. 現在値との一致確認
select
  count(*) as mismatch_count
from public.employees e
join public.employee_assignment_history h
  on h.employee_id=e.id
 and h.effective_to is null
where e.center_id is distinct from h.center_id
   or e.division_id is distinct from h.division_id
   or e.position_id is distinct from h.position_id
   or e.grade_id is distinct from h.grade_id;

-- C. 現行履歴が複数ある社員（0件が正常）
select employee_id, count(*) as active_history_count
from public.employee_assignment_history
where effective_to is null
group by employee_id
having count(*) > 1
order by active_history_count desc;

-- D. grade_id未設定は推測補完されていないこと
select
  count(*) filter (where grade_id is null) as history_grade_id_missing,
  count(*) as history_total
from public.employee_assignment_history;
