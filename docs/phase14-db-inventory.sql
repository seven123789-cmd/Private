-- Phase14: 人事データ基盤 現状棚卸し（READ ONLY）
-- 2026-08-11
-- このSQLはDBを変更しません。結果を確認してから正式データモデルを設計します。

-- 1) publicテーブル一覧
select
  c.relname as table_name,
  obj_description(c.oid) as comment
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

-- 2) 全カラム
select
  table_name, ordinal_position, column_name, data_type,
  is_nullable, column_default
from information_schema.columns
where table_schema='public'
order by table_name, ordinal_position;

-- 3) PK / UNIQUE / FK
select
  tc.table_name, tc.constraint_name, tc.constraint_type,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name
 and tc.table_schema=kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name=ccu.constraint_name
 and tc.table_schema=ccu.table_schema
where tc.table_schema='public'
  and tc.constraint_type in ('PRIMARY KEY','UNIQUE','FOREIGN KEY')
order by tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 4) RLS状態
select
  n.nspname as schema_name, c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

-- 5) RLSポリシー
select
  schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
order by tablename, policyname;

-- 6) publicビュー
select table_name, view_definition
from information_schema.views
where table_schema='public'
order by table_name;

-- 7) 行数概算（統計値。正確なCOUNTではない）
select
  relname as table_name,
  n_live_tup as estimated_rows
from pg_stat_user_tables
where schemaname='public'
order by relname;
