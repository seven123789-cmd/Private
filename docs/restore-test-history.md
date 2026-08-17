# 復元テスト履歴
更新日: 2026-08-17

このファイルには個人情報、DB URL、パスワード、アクセストークンを記載しない。

| 実施日 | Backup世代 | Baseline | Schema Version | 復元先区分 | SHA-256 | DB検証 | App E2E | 実施者 | 確認者 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-17 | Phase26L基準状態 | baseline-20260817-phase26l-final | 2026.08.17-phase26l-124 | DB内部Baseline検証 | — | OK (29表 / NG0 / DIFF0 / CHECK0) | 監査E2EまでOK | — | — | 別Supabase Projectへの実Restoreは未実施 |

## 記録ルール
- 実Restoreを行った場合のみ新しい行を追加する。
- `restore-result.json` 本体はGitへ置かない。
- Git側には世代識別子と合否だけを残す。
- 失敗も削除せず記録し、原因と再試験結果を残す。
