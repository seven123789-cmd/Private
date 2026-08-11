# DBロードマップ
基準日: 2026-08-11

## 現状
employees / license_master / license_categories / employee_licenses と既存ビューは破壊的変更を行わない。

## 優先実装
1. employees.employee_code の一意性確認・制約
2. 更新系テーブルへの created_at / created_by / updated_at / updated_by
3. audit_log
4. evaluation_cycles / employee_evaluations
5. promotion_history
6. employee_license_history
7. employee_history（所属・役職・雇用）
8. documents（証憑・添付書類）
9. RLS/権限設計

## 一括取込をDB直結する前の確認事項
- employee_code にDB上の UNIQUE 制約が存在するか
- anon/authenticated ロールの INSERT/UPDATE 権限とRLS
- 既存社員を更新するのか、新規だけ追加するのか
- 退職者・取込ファイルから消えた社員をどう扱うか
- 部分失敗時のロールバック方法
- 取込実行者と実行結果をどこへ記録するか

確認後、「差分プレビュー → トランザクション相当の一括反映 → 監査記録」を実装する。
