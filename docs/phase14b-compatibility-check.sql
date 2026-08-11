-- Phase14-B: 設計確認用（READ ONLY）
-- 2026-08-11
-- 正式設計へ進む前の依存確認。DB変更なし。

-- 互換列を参照しているpublicビューを抽出
select table_name, view_definition
from information_schema.views
where table_schema='public'
  and (
    view_definition ilike '%employees.center%'
    or view_definition ilike '%employees.position%'
    or view_definition ilike '%employees.current_grade%'
    or view_definition ilike '%license_master.category%'
    or view_definition ilike '%facility_licenses.center%'
  )
order by table_name;

-- ID列の充足状況（実データ投入後にも再利用可能）
select
  count(*) as employees_total,
  count(*) filter (where center_id is null) as center_id_missing,
  count(*) filter (where division_id is null) as division_id_missing,
  count(*) filter (where position_id is null) as position_id_missing,
  count(*) filter (where grade_id is null) as grade_id_missing
from public.employees;

-- 資格カテゴリIDの充足状況
select
  count(*) as license_master_total,
  count(*) filter (where category_id is null) as category_id_missing
from public.license_master;
