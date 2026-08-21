-- Phase26N 等級・昇格 正本確認
-- 2026-08-21 / 読み取り専用
-- 正本ルール:
--   ・正式人事履歴: public.employee_hr_history_official
--   ・社員マスタの最終資格昇格日: public.employees.last_promotion_date
--   ・旧 promotion_last_date は廃止済み前提。再作成・再利用しない。
--   ・資格変更日の画面計算は正式人事履歴を基準とする。
--   ・根拠不明な旧補助値は正式履歴へ推測転記しない。

WITH official_latest AS (
  SELECT
    employee_id,
    MAX(effective_date) AS official_last_promotion_date
  FROM public.employee_hr_history_official
  WHERE status = 'active'
    AND event_type LIKE '%資格昇格%'
    AND effective_date IS NOT NULL
  GROUP BY employee_id
)
SELECT
  COUNT(*) AS employees_total,
  COUNT(*) FILTER (WHERE e.last_promotion_date IS NOT NULL) AS last_promotion_date_set,
  COUNT(*) FILTER (WHERE o.official_last_promotion_date IS NOT NULL) AS official_promotion_set,
  COUNT(*) FILTER (
    WHERE o.official_last_promotion_date IS NOT NULL
      AND e.last_promotion_date IS DISTINCT FROM o.official_last_promotion_date
  ) AS canonical_mismatch_count
FROM public.employees e
LEFT JOIN official_latest o ON o.employee_id = e.id;
