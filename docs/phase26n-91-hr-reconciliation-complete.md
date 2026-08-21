# Phase26N-91 人事データ残件・不整合 総点検 完了記録
実施日: 2026-08-22
基準GitHub main SHA: 71ed77f816f6fe3e22ecb666aeab2536627e035d

## 実DB確認結果
Supabaseで総点検SQLを実行し `Success. No rows returned` / 0 rows を確認。

確認対象:
- 正式資格昇格履歴と employees.last_promotion_date の不一致
- employees.current_grade と最新active正式等級履歴の不一致
- employee_hr_history_official の孤立active履歴
- employees.employee_code の重複
- 同一社員・同一発令日・同一event_typeのactive正式履歴重複候補

結果: すべて0件。

## 確定
過去の業務差異・基盤差異の残件件数は引き継がず、2026-08-22時点の現行実DBで残件0としてPhase26N-91を完了する。

今後の原則:
1. 正式根拠を確認できるものは正式履歴へ確定する。
2. 十分確認しても根拠を確認できない旧補助値は正式データとして採用しない。
3. 不採用確定した旧値を保留データとして残し続けない。
4. employee_hr_history_official のactive正式履歴を履歴正本とする。
5. 最終資格昇格日は正式履歴と employees.last_promotion_date の整合を維持する。
6. 廃止済み promotion_last_date は再作成・再利用しない。
