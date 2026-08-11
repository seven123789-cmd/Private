# 人事評価・昇格 データ契約（Phase5）

確認日: 2026-08-11

## 現行データ
現行画面が確実に参照できるのは employees の以下の項目です。
- id
- employee_code
- name
- center
- division
- position
- employment_type
- current_grade
- promotion_target_flag
- last_promotion_date

Phase5では既存DBスキーマを変更しない。`promotion_target_flag` は「現在の候補判定」であり、年度別評価結果や昇格決定履歴とは扱わない。

## 長期運用で推奨するDB分離
### evaluation_cycles
- id
- fiscal_year
- period_code
- name
- start_date / end_date
- status

### employee_evaluations
- id
- employee_id
- evaluation_cycle_id
- first_rating
- final_rating
- first_evaluator_id
- final_evaluator_id
- comment
- status
- created_at / created_by
- updated_at / updated_by

### promotion_history
- id
- employee_id
- effective_date
- from_grade
- to_grade
- decision_status
- approved_by
- source_evaluation_id
- created_at / created_by

## 設計原則
- 社員の現在等級は `employees.current_grade` に持ってよいが、過去の昇格履歴は別テーブルへ保存する。
- 年度ごとの評価を上書きしない。
- 社員名や等級名を履歴の主キーにしない。社員ID・評価サイクルIDを使用する。
- 昇格決定時に current_grade を更新する場合も、promotion_history を同一トランザクションで作成する設計が望ましい。
- 操作者と更新日時を必ず記録し、監査・復元に利用できるようにする。

## 入出力
Phase5のCSV出力は UTF-8 BOM / CRLF。
将来のCSV取込では employee_code を外部照合キーとして使用し、氏名一致だけで社員を特定しない。
年度別評価取込では fiscal_year + period_code + employee_code を業務上の一意照合キー候補とする。
