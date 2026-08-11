# Phase9 DB移行前判定
基準日: 2026-08-11

今回はDBを変更していない。

## 先に確認するもの
`phase9-db-preflight.sql` をSupabase SQL Editorで実行し、結果を保存する。

確認後に初めて以下を判断する。
- employees.employee_code の UNIQUE 制約追加可否
- created_at / created_by / updated_at / updated_by の追加
- audit_log の作成
- RLSポリシー
- 社員一括取込の upsert 方針

重複社員コードが1件でも存在する場合、UNIQUE制約を先に追加してはいけない。
RLSの現状を確認せずブラウザから一括UPDATE/UPSERTを有効にしない。
