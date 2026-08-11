# Phase14 人事データ基盤・現状棚卸し

基準日: 2026-08-11

## 結論
このPhaseではDB変更を行わない。
現行DBのテーブル、カラム、キー、FK、RLS、ビュー、概算件数を実測し、
その結果を基に「10年運用できる正式人事データモデル」を確定する。

## 最新コード側で確認した主な人事領域
- 社員
- 資格・免許
- 事業所資格
- 昇格評定
- マスタ
- 社員取込
- データ運用
- Supabase Auth / user_profiles

## 次の設計で判定するもの
1. employeesを社員の唯一の基点として維持できるか
2. center/division/position/grade の文字列列とID列の二重管理解消
3. 異動・役職・等級・昇格を「現在値」と「履歴」にどう分離するか
4. employee_licenses と license_master の正規化状態
5. 退職者を削除せず履歴として保持する方式
6. CSV取込の一意キーと更新ルール
7. 監査用 created_at / updated_at / source_file 等の統一
8. 将来のバックアップ・復元・エクスポート単位

## 実行
`phase14-db-inventory.sql` 全文をSupabase SQL Editorで実行する。
READ ONLYであり、CREATE/ALTER/DROP/INSERT/UPDATE/DELETEは含まない。

結果は複数Resultになるため、テーブル一覧・全カラム・制約/FKが分かる画面を共有する。
その実測結果をもとにPhase14-Bの正式設計へ進む。
