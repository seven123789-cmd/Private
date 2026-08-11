-- Phase9 DB事前確認SQL
-- 2026-08-11
-- 読み取り専用。まずSupabase SQL Editorで結果を確認する。
-- このファイルはスキーマ変更を行わない。

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='employees'
order by ordinal_position;

select tc.constraint_name, tc.constraint_type, kcu.column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
where tc.table_schema='public' and tc.table_name='employees'
order by tc.constraint_type, tc.constraint_name;

select employee_code, count(*)
from public.employees
where employee_code is not null
group by employee_code
having count(*) > 1
order by employee_code;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in ('employees','employee_licenses','license_master','license_categories')
order by tablename, policyname;
