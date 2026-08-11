# Phase14-B 正式人事データモデル設計
基準日: 2026-08-11

## 結論
現行DBは全面再構築せず、employeesを社員の基点として維持する。
既存画面を壊さないため、文字列列は当面互換列として残し、ID列を正規データへ段階移行する。
履歴は「現在値」と分離し、CSV取込はemployee_codeを外部一意キーとする。

## 実DB確認値
- publicのテーブル: 16
- publicのビュー: 6
- 全カラム: 225
- PK/UNIQUE/FK抽出結果: 51行
- employees.employee_code: UNIQUE
- employees: center_id / division_id / position_id / grade_id にFKあり
- employee_licenses: employee_id + license_id の複合UNIQUEあり
- overtime / paid_leave: employee_id + year_month の複合UNIQUEあり
- user_profiles: auth.usersと1対1

## 正式モデル
### 1. 社員コア
employees
- id: 内部UUID
- employee_code: 外部・CSV連携用一意キー
- 氏名等の本人基本属性
- current center/division/position/grade は *_id を正とする
- retirement_date / is_active / status で在退職を保持
- 削除を通常運用にしない

### 2. 組織・職位・等級
centers / divisions / positions / grades をマスタとして維持。
将来、名称変更しても履歴参照が壊れないようUUID参照を基本とする。

### 3. 履歴
既存 promotion_history は昇格履歴として維持。
Phase15以降で employee_assignment_history を追加し、
所属・部署・役職・等級の有効期間履歴を一元管理する。

### 4. 資格
license_categories → license_master → employee_licenses を正式系統とする。
license_master.category は互換列、category_idを正とする。
facility_licensesは事業所単位資格として社員資格と分離維持。

### 5. 月次人事データ
overtime / paid_leave は employee_id + year_month を一意単位として維持。
CSV再取込時は同一社員・同一月を重複追加しない。

## 段階廃止候補（今は削除禁止）
employees.center
employees.center_code
employees.division
employees.position
employees.current_grade
license_master.category
facility_licenses.center
promotion_history.before_grade
promotion_history.after_grade

これらは既存HTML/JS/Viewの依存確認と移行完了まで残す。

## 今後追加すべき履歴テーブル
employee_assignment_history
- id uuid PK
- employee_id uuid FK
- center_id uuid FK
- division_id uuid FK
- position_id uuid FK
- grade_id uuid FK
- effective_from date NOT NULL
- effective_to date NULL
- change_type text
- source text
- memo text
- created_at timestamptz
- updated_at timestamptz

現在所属はemployees、過去履歴はhistoryという役割分担にする。

## データ入出力方針
- employee_codeをCSVの安定キーとする
- UUIDを利用者に入力させない
- 取込は validate → preview → upsert → result の4段階
- 原本ファイル名/source_fileを保持
- エラー行は全体停止ではなく理由付きで返せる設計へ
- 出力は社員基本、資格、所属履歴、残業、有休を独立CSV化可能にする
- 将来の完全バックアップはDBダンプを正とし、CSVは業務交換用とする

## Phase15
employee_assignment_historyを安全に追加し、
既存employeesを初期履歴としてバックフィルする。
この時点でも既存列は削除しない。
