# Phase15 社員所属・役職・等級履歴基盤
基準日: 2026-08-11

## 結論
employeesを「現在値」の正本として維持し、employee_assignment_historyを「履歴」の正本として追加する。
既存HTML/CSS/JS、既存employees列、既存98人は変更・削除しない。

## 実測値を反映
- employees: 98件
- center_id欠損: 0
- division_id欠損: 0
- position_id欠損: 0
- grade_id欠損: 43
- grade_id欠損43件は推測で埋めない

## 安全策
- employee FKは ON DELETE RESTRICT
- マスタFKも ON DELETE RESTRICT
- effective_to < effective_from を禁止
- employee_id + effective_from の重複を禁止
- 再実行時は既に履歴がある社員をバックフィルしない
- 認証済みユーザーのみRLS対象
- 既存employeesはALTERしない

## 初期履歴の日付
join_dateがある社員: join_date
join_dateが無い社員: 2026-08-11
これは「過去の所属を推測」するものではなく、現在確認できる所属状態の初期スナップショット。

## 正常判定
Verification A:
employees_total = 98
history_total = 98
employees_with_history = 98

Verification B:
mismatch_count = 0

Verification C:
0 rows

Verification D:
history_grade_id_missing = 43
history_total = 98

上記が一致しない場合は次Phaseへ進まず停止する。
