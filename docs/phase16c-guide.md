# Phase16-C 安全動作試験
基準日: 2026-08-11

## 目的
Phase16-Bで作成したDB関数を、本番データを残存変更せずに試験する。

## 実行順
1. `phase16c-safe-no-change-test.sql` を全文貼付してRun
2. エラーが出ないことを確認
3. `phase16c-post-rollback-verification.sql` を全文貼付してRun

## 重要
本体SQLは BEGIN ～ ROLLBACK で囲んでいる。
テスト中の処理は最後に破棄される。

また今回は「同一内容での更新要求」をテストする。
関数が不要な履歴を増やさないことを確認する工程。

## ロールバック後の正常値
- employees_total = 98
- history_total = 98
- current_history_total = 98
- duplicate_active_employees = 0
- mismatch_count = 0

## 次
正常ならPhase16-Dへ進む。
次は画面接続前のAPI/Repository層を設計し、
既存画面を壊さず社員詳細画面から履歴参照できるところから接続する。
