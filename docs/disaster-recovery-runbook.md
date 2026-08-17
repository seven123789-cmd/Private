# 災害復旧・バックアップ運用手順
基準日: 2026-08-17

## 1. 目的

統合管理システムを10年以上継続利用する前提で、データ消失・誤更新・Supabaseプロジェクト障害・別環境移行に備える。

この手順では次の3層を分離する。

1. Supabaseプラットフォーム側バックアップ
2. Supabase外に保管する論理バックアップ
3. DB内部の復元検証基準（Baseline / Manifest / Schema Version）

「バックアップが存在する」だけでは完了とせず、定期的に別環境へ復元し、復元後の整合性を検証する。

---

## 2. 現在のDB内部復旧基盤

2026-08-17時点の確定状態:

- Backup Manifest: 29表
- Natural Key未設定: 0表
- 最終Baseline: `baseline-20260817-phase26l-final`
- Baseline対象: 29表
- Schema Version: `2026.08.17-phase26l-124`
- 復元POSTCHECK: NG 0 / DIFF 0 / CHECK 0
- 監査E2E Probe: 1件保持
- `verify_restore_baseline()` は選択Baseline自身のSchema Versionを基準に検証
- 監査ログ、社員取込バッチ、復元Manifest、Schema Versionはバックアップ対象

---

## 3. Supabase側で確認する項目

### 3.1 Database Backup

Supabase管理画面で以下を確認し、確認日を記録する。

- 自動Database Backupが利用可能な状態か
- 直近Backupの成功日時
- 保持期間
- 復元可能な世代
- Point-in-Time Recovery (PITR) の有効・無効
- 復元操作が可能な権限を持つ管理者

この設定はDB内SQLだけでは確定できないため、管理画面側の運用確認項目とする。

### 3.2 Storage

Database BackupだけではStorage APIで保存したオブジェクト実体の保全を代替しない。

現在Storageを業務利用していない間も、将来添付書類機能を追加した時点で以下を同一世代で保全する。

- DBのStorageメタデータ
- Storageオブジェクト実体
- Bucket構成
- Storage Policy

---

## 4. Supabase外バックアップ

### 4.1 原則

バックアップを本番Supabaseプロジェクト内だけに置かない。

少なくとも1系統は、Supabase障害と同時に失われない場所へ保管する。

### 4.2 論理バックアップの対象

完全な移行・復旧用バックアップでは、少なくとも以下を含める。

- public schema
- public data
- Auth関連データ（必要な場合）
- Functions / RPC
- Views
- Triggers
- RLS / Policies
- Grants
- Extensionsの構成情報
- Schema Version
- Backup Manifest
- Restore Baseline
- Audit Log
- Import Batch / Import Items

CSV/Excelの業務出力は完全バックアップの代替にしない。

### 4.3 保管ルール

会社の情報セキュリティ方針に合わせて次を決める。

- 保管場所
- 暗号化
- アクセス権
- 保持世代
- 保持期間
- 削除方法
- バックアップ取得担当
- 復元承認者

個人情報を含むため、個人PCや無管理のUSBメモリを恒久保管先にしない。

---

## 5. 推奨運用周期

実運用開始時の基準案:

- 毎日: Supabase側自動Backup状態の確認（自動運用）
- 毎週: Supabase外論理バックアップ
- 毎月: Backup取得結果・ファイル存在・サイズの確認
- 四半期: 隔離した検証環境への復元テスト
- 大規模DB変更前: 臨時Backup取得
- 大規模DB変更後: 新Baseline作成と復元検証

実際の頻度は会社ルール・契約プラン・データ更新量に合わせて決定する。

---

## 6. 復元手順

### Step 1: 障害範囲を確定

以下を区別する。

- 1件の誤更新
- 複数行の誤更新
- テーブル破損
- DB全体障害
- Supabaseプロジェクト障害
- 認証障害
- Storage障害

軽微な誤更新でDB全体を戻さない。

### Step 2: 復元先を分離

原則、本番へ直接復元せず隔離した検証環境へ先に復元する。

### Step 3: Schemaを復元

Extensions、Functions、Triggers、RLS/Policies、Viewsを含め、アプリが必要とする構造を再現する。

### Step 4: Dataを復元

PK/FKを保持して復元する。
UUIDをstable restore identityとして指定している表はUUIDを変更しない。

### Step 5: Schema Version確認

復元したDBのSchema Versionと使用するアプリコードの対応を確認する。

### Step 6: DB内部検証

復元後に次を実行する。

`verify_restore_baseline('baseline-20260817-phase26l-final')`

確認項目:

- NG = 0
- DIFF = 0
- CHECK = 0
- 重要FK孤児 = 0
- Schema Version一致

新しいBaselineへ更新した場合は、その時点の正式Baseline名を使う。

### Step 7: アプリE2E

最低限次を確認する。

- ログイン
- 社員一覧
- 社員詳細
- 正式人事履歴
- 資格・免許
- 事業所資格
- アラート
- 人事評価・昇格
- データ運用確認
- 監査ログ
- CSV出力

### Step 8: 本番復旧承認

検証完了後に本番切替を行う。
復旧日時、使用Backup、Schema Version、検証結果、実施者を記録する。

---

## 7. 復元してはいけない判断

次の場合は復元を中止し、原因確認を優先する。

- Backupの取得日時が不明
- Schema Versionが不明
- 復元後に重要業務テーブルでDIFF
- FK孤児が発生
- Authユーザーが欠落
- RLS/Policyが不足
- Functions/Triggersが不足
- Storageを使用しているのにStorage実体がない

---

## 8. Baseline更新ルール

Baselineは「差異を消すため」に更新しない。

更新してよいのは以下をすべて満たした場合。

1. 変更内容が正式な仕様変更
2. 業務データの内容が確認済み
3. Schema Version登録済み
4. 変更後POSTCHECKが正常
5. 監査・履歴を削除していない
6. 新Baseline作成理由を記録できる

旧Baselineは原則削除せず、過去状態の復旧・監査材料として保持する。

---

## 9. 外部運用で未確認の項目

2026-08-17時点でDB内部からは確認できていない。

- 本番プロジェクトでPITRが実際に有効か
- Supabase側Backupの保持期間
- Supabase外論理バックアップの実保管先
- 世代数・保持期間
- 復元テスト用Supabaseプロジェクト
- バックアップ/復旧の社内担当者・承認者

これらはシステム不具合ではなく、運用開始前に決定する管理項目。

---

## 10. 公式仕様確認メモ

2026-08-17にSupabase公式ドキュメントを確認。

- SupabaseはDatabase Backup機能を提供している。
- Point-in-Time Recoveryは契約・設定条件に依存するため、本番プロジェクト側で有効状態を確認する。
- PITRまたはphysical backup利用時でも、Supabase CLI `db dump` / PostgreSQL `pg_dump` による論理バックアップを取得できる。
- Database BackupはStorage APIのオブジェクト実体を含まないため、Storage利用開始後は別途保全が必要。
- 別Supabaseプロジェクトへの手動復元では、CLI / PostgreSQLツールを利用する公式手順が提供されている。

### 参照
- Supabase Docs: Database
- Supabase Docs: Backup and Restore using the CLI
- Supabase Docs: How to download logical backups with physical backups enabled
- Supabase Docs: Restore a Platform Project to Self-Hosted

