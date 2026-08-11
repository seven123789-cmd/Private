# Phase10 実DB確認結果
確認日: 2026-08-11

## employees
- id: uuid / NOT NULL / PRIMARY KEY
- employee_code: varchar / NOT NULL / UNIQUE
- name: varchar / NOT NULL
- center: varchar / NOT NULL
- created_at / updated_at: 存在
- center_id / division_id / position_id / grade_id: UUID外部キー
- promotion_target_flag: boolean
- last_promotion_date と promotion_last_date が併存（整理は別フェーズ）

## データ品質
employee_code 重複確認: 0件。

## RLS確認
- employees: anon SELECT true
- employees: authenticated ALL true / with_check true
- employee_licenses: authenticated ALL
- license_master: authenticated ALL
- license_categories: 今回取得結果ではポリシー確認できず

## Phase10の実装判断
社員取込は employee_code を conflict key とする。
ファイルにない社員を削除・退職化しない。
DB書込はSupabase認証済みセッションが存在する場合のみ許可する。
認証画面が未整備のため、全ページのrequireAuth強制化とanon SELECT削除はまだ行わない。
