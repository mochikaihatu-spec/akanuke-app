@AGENTS.md

# アカヌケ(akanuke-app)プロジェクト要点

詳細は `docs/01_investigation.md`(現状・セキュリティ)と `docs/02_roadmap.md`(計画)。**再調査せず、まずこの2つを読むこと。**

## コンセプト
「憧れを、あなた専用の行動プランに。」憧れの雰囲気を実行できる要素に分解し、今日のミッション+週間プランにする AI コーチ。ユーザーは日本の大学生の初心者プログラマー(週5時間)。説明は日本語・初心者向けに。

## 技術構成
Next.js 16.3.2(App Router。`middleware` は `src/proxy.ts`)/ React 19 / TypeScript / Tailwind v4 / recharts。Supabase(Auth + Postgres RLS + 非公開 Storage `meal-photos`)。Anthropic API(`claude-sonnet-5`、`/api/*` のサーバー側のみ)。Vercel(main に push で自動デプロイ)。PHP は使っていない。テスト・CI なし。

## 守るルール
- **認証**: 全ページ・全 `/api/*` は `src/proxy.ts` で未ログインを遮断。新しい API/テーブルを作るときは必ず `user_id` + RLS「自分の行だけ」を付ける。
- **秘密情報**: `.env*`・Vercel の値・API キーをログ/出力/コミットに出さない。AI キーは `NEXT_PUBLIC_` を付けない。
- **禁止(許可なし)**: DB 削除、認証設定の変更、環境変数の上書き、本番への破壊的操作、無差別なパッケージ更新。
- **AI の安全ルール**: 整形・医療行為の推奨、診断、容姿の採点/ランク付け、特定の実在人物との類似の断定/約束、極端な食事制限は禁止。AI はプランを JSON で返し、画面は決まった UI で描画する(AI に画面を自由に作らせない)。ユーザー承認済みプランを黙って変えない。
- **開発**: 小さなタスク・最小変更・変更前に計画提示・変更後に build/動作確認・コミット/プッシュ前にユーザーに確認。大規模リファクタ禁止。
- UI: スレート基調+青アクセント、カードは `rounded-3xl border border-slate-100 bg-white p-6 shadow-sm`。
- `AGENTS.md` は `next dev` が管理する(編集しない)。`CLAUDE.md` は自由に編集してよい(`@AGENTS.md` の行は残す)。

## 現在の状態(2026-10-25)
- ログイン・ユーザー別データ分離は実装・デプロイ済み(コミット e22c2af)。
- **未対応(公開前に必須)**: AI 利用回数制限、API 入力長制限、共通 AI 安全プロンプト、Next.js/sharp 更新(16.4.x)、キー再発行、セキュリティヘッダー、プライバシーポリシー・利用規約・アカウント削除、Supabase Auth のメール確認設定。
- ESLint に 3 エラー(`set-state-in-effect`)あり。

## 次の手順
`docs/02_roadmap.md` の **フェーズ 0-1(AI 利用制限 + 入力長制限 + API 内ログイン確認 + 共通安全プロンプト)** から。ユーザーの承認後に実装。進捗は `docs/02_roadmap.md` の「進捗メモ」に追記する。
