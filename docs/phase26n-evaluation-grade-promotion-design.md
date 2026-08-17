# Phase26N 人事評価・等級昇格 基礎設計
確認日: 2026-08-17

## 1. 目的
年度別人事評価と等級昇格を、正式人事履歴へつながる長期運用データとして管理する。

今回の「昇格」は役職変更ではなく等級変更を指す。

例:
- 3級 → 4級: 等級昇格
- 4級 → 5級: 等級昇格
- 主任 → 副長: 役職変更であり、これだけでは等級昇格ではない
- センター長就任: 役職変更であり、これだけでは等級昇格ではない
- 所属センター変更: 異動であり、等級昇格ではない

## 2. 最終等級昇格日
社員一覧・昇格画面で使用する「最終昇格日」は、正式人事履歴のうち等級が実際に上がった最新の発令日を正本とする。

役職変更日を混在させない。

既存employeesには `last_promotion_date` と `promotion_last_date` が併存していることが既存資料で確認されているため、Phase26Nでは実DB・正式履歴を確認してから整理する。推測で片方を削除・上書きしない。

## 3. 経過期間
DBへ「8.3年」のような経過値を保存しない。

正本:
`last_grade_promotion_date`

表示時:
`基準日 - last_grade_promotion_date`

表示例:
- 8年4か月
- 3年0か月
- 昇格履歴なし
- 要確認

社員一覧では経過期間による昇順・降順ソートを可能にする。

## 4. 昇格履歴なし
正式履歴に等級昇格が存在しない社員について、入社日を勝手に最終昇格日として代用しない。

必要なら別項目として在籍年数を扱う。

## 5. 年度別評価
Phase5案を現在の「1人運用」に合わせて簡素化する。

### evaluation_cycles
- id
- fiscal_year
- period_code
- name
- start_date
- end_date
- status
- created_at
- updated_at

### employee_evaluations
- id
- employee_id
- evaluation_cycle_id
- rating
- comment
- status
- evaluated_at
- created_at
- updated_at

原則として不要:
- first_evaluator_id
- final_evaluator_id
- approved_by
- 多段階承認ワークフロー

操作者の追跡は既存認証・audit_logを利用する。

## 6. 昇格決定
新しい独立した `promotion_history` を安易に正本化しない。

現在すでに正式人事履歴 `employee_hr_history_official` が存在するため、
等級昇格の正式決定は同履歴へ接続することを第一候補とする。

評価:
`employee_evaluations`

↓ 昇格判断

正式発令:
`employee_hr_history_official`

↓ 最新等級昇格日算出

社員一覧 / 人事評価・昇格画面

という一本の経路を目標とする。

## 7. 既存 promotion_target_flag
現時点では現在の候補フラグとして維持する。

年度別評価結果そのもの、昇格決定そのものとして扱わない。

Phase26Nで評価基盤が完成しても、既存画面を壊さないよう段階的に接続する。

## 8. 実装順
1. 実DBの昇格日2カラムと正式履歴構造を確認
2. 正式履歴から等級昇格だけを確実に抽出する条件を確定
3. 最終等級昇格日View/RPCを設計
4. 社員一覧へ「最終等級昇格日」「昇格後経過」を追加
5. 経過期間ソートを追加
6. promotion画面にも同じ基準を使用
7. evaluation_cycles / employee_evaluationsを追加
8. 評価→昇格候補→正式人事履歴を接続
9. CSV入出力・監査・Backup Manifestへ統合
