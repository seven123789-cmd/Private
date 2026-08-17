Phase26N-81 GitHub投入用
対象: assets/js/data_operations.js

変更内容:
既存の「退職者・退職日未設定」監査ブロックを同梱の replacement.txt の内容へ置換する。

目的:
・通常退職で退職日不明 → 「退職日未確認」（情報状態。要確認警告にしない）
・出向等によるシステム上退職 → 「マスタ上退職扱い」（情報状態）
・在籍状態なのに退職日あり → 従来どおり「在籍状態・退職日矛盾」として警告
・退職日を推測補完しない

前提:
Phase26N-81 DB SQL投入済み。
employees.retirement_date_status / retirement_handling_type / retirement_note が存在する。
