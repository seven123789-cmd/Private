# 資格・免許管理 データ契約（Phase3）

## 現行接続（2026-08-11確認）
- employees: 社員マスタ
- license_master: 資格・免許マスタ
- license_categories: 資格区分
- employee_licenses: 社員保有資格の登録先
- v_license_screen: 資格・免許管理画面の参照ビュー
- v_employee_license_alerts: 期限アラート参照ビュー

## employee_licenses で現行UIが使用する項目
- employee_id
- license_id
- acquired_date
- renewal_date
- expiration_date
- memo

## 長期運用で追加を推奨（今回はDB変更なし）
- license_number: 免許証番号等を memo から分離
- status: 有効/失効/返納等（期限判定とは別概念）
- issued_by: 発行機関
- attachment_id または document テーブル連携
- created_at / created_by
- updated_at / updated_by

## 更新履歴
employee_licenses を上書きするだけでなく、将来は employee_license_history 等へ
更新前後・更新日時・操作者を保存する。監査・復元・資格更新履歴に使用する。

## CSV
Phase3のCSV出力は UTF-8 BOM / CRLF。
画面表示名を列名にし、日付はDB値 YYYY-MM-DD を維持する。
取込機能を追加する際は、社員名ではなく社員コード、資格名ではなく資格コード/IDを
照合キーにする設計を推奨する。
