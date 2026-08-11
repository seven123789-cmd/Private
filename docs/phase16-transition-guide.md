# Phase15最終確認 → Phase16-A

基準日: 2026-08-11

## 先に実行
`phase15-final-verification.sql`

正常値:
- employees_total = 98
- history_total = 98
- employees_with_history = 98
- mismatch_count = 0
- duplicate_active_employees = 0
- history_grade_id_missing = 43

6項目が1行で表示される。

## 一致した場合のみ
`phase16a-one-current-history-guard.sql` を実行。

正常値:
- one_current_guard_enabled = true
- duplicate_active_employees = 0

## Phase16-Aの意味
アプリ側のバグや将来の取込処理ミスがあっても、
同じ社員に「現在所属」が2件同時に存在する状態をDB側で拒否する。

## 次段階
Phase16-Bでは、異動・役職変更・等級変更を
「旧履歴を閉じる → 新履歴を作る → employees現在値を更新」
の単一トランザクションで行うDB関数を設計する。
