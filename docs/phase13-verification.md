# Phase13 ユーザー管理基盤

確認基準日: 2026-08-11

## 目的
現在は1名運用のため本格RBACは実装せず、将来の複数ユーザー化に必要な受け皿だけを作る。

## 今回追加するもの
- `public.user_profiles`
- Authの `auth.users.id` と1対1
- `role`: admin / editor / viewer
- `is_active`
- 自分自身のプロフィールのみSELECT可能なRLS
- 既存Authユーザーを初回adminとして自動登録

## 今回あえて実装しないもの
- 権限別の業務テーブル制御
- ブラウザからのユーザー追加・権限変更
- 管理画面
- editor/viewer用UI

## 実行後の確認
SQL Editorの最終SELECT結果で、現在のAuthユーザーが1行表示され、
`role = admin`、`is_active = true` ならPhase13完了。
