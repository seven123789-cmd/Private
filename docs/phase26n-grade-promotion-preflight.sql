-- Phase26N-1～8 等級昇格基準データ確認
-- 2026-08-17 / 読み取り専用
-- 目的:
-- 1) employees.last_promotion_date / promotion_last_date の現況確認
-- 2) 正式人事履歴から「等級が実際に変わった発令」だけを抽出可能か確認
-- 3) 役職変更・異動を最終等級昇格日に混ぜない
-- 4) Phase26Nの評価DBを作る前に実DB構造を確定する

SELECT
 'COLUMN' AS category,
 c.table_name AS object_name,
 c.column_name AS item,
 concat_ws(' / ','type='||c.data_type,'nullable='||c.is_nullable,'default='||coalesce(c.column_default,'NULL')) AS detail
FROM information_schema.columns c
WHERE c.table_schema='public'
  AND c.table_name IN ('employees','employee_hr_history_official')
  AND (
    c.table_name='employee_hr_history_official'
    OR c.column_name IN (
      'id','employee_code','name','current_grade','grade_id',
      'promotion_target_flag','last_promotion_date','promotion_last_date'
    )
  )

UNION ALL

SELECT
 'CONSTRAINT',
 tc.table_name,
 tc.constraint_name,
 tc.constraint_type||' / columns='||
 coalesce(string_agg(kcu.column_name,',' ORDER BY kcu.ordinal_position),'')
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
 ON kcu.constraint_schema=tc.constraint_schema
AND kcu.constraint_name=tc.constraint_name
AND kcu.table_name=tc.table_name
WHERE tc.table_schema='public'
  AND tc.table_name IN ('employees','employee_hr_history_official')
GROUP BY tc.table_name,tc.constraint_name,tc.constraint_type

ORDER BY category,object_name,item;

-- 現在の二重昇格日カラムの差異
SELECT
 count(*) AS employees_total,
 count(*) FILTER(WHERE last_promotion_date IS NOT NULL) AS last_promotion_date_set,
 count(*) FILTER(WHERE promotion_last_date IS NOT NULL) AS promotion_last_date_set,
 count(*) FILTER(
   WHERE last_promotion_date IS DISTINCT FROM promotion_last_date
 ) AS promotion_date_column_diffs
FROM public.employees;

-- 正式履歴の実データ例（等級関連を優先）
SELECT *
FROM public.employee_hr_history_official
WHERE
  coalesce(to_jsonb(employee_hr_history_official)->>'from_grade','') <> ''
  OR coalesce(to_jsonb(employee_hr_history_official)->>'to_grade','') <> ''
ORDER BY
 coalesce(
   to_jsonb(employee_hr_history_official)->>'effective_date',
   to_jsonb(employee_hr_history_official)->>'event_date',
   ''
 ) DESC
LIMIT 50;
