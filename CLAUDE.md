@AGENTS.md

# アカヌケ(akanuke-app)プロジェクト要点

詳細は `docs/01_investigation.md`(現状・セキュリティ)と `docs/02_roadmap.md`(計画)。**再調査せず、まずこの2つを読むこと。**

## コンセプト
「憧れを、あなた専用の行動プランに。」憧れの雰囲気を実行できる要素に分解し、今日のミッション+週間プランにする AI コーチ。ユーザーは日本の大学生の初心者プログラマー(週5時間)。説明は日本語・初心者向けに。

## 技術構成
Next.js 16.4.3(App Router。`middleware` は `src/proxy.ts`)/ React 19 / TypeScript / Tailwind v4 / recharts。Supabase(Auth + Postgres RLS + 非公開 Storage `meal-photos`)。Anthropic API(`claude-sonnet-5`、`/api/*` のサーバー側のみ)。Vercel(main に push で自動デプロイ)。PHP は使っていない。テスト・CI なし。

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
- **完了(0-1 + 料金プラン)**: AI の利用回数は **サーバー側で管理**(`src/lib/ai-guard.ts`)。新しい `/api/*` は「入力チェック → `beginAiRequest(kind)` → AI 呼び出し → `finally` で `finishAiRequest`(成功時だけ回数が増える・失敗は数えない・トークン数を `ai_usage_logs` に記録)」の順で作り、`withSafetyRules(prompt)` と `anthropicOptions(kind)`(`src/lib/ai-config.ts`)を使う。**無料/有料と各上限・価格は `src/lib/plans-config.ts` の数字だけで変えられる**(無料: プラン月1/美容月20、有料(月680円・案): プラン月4/美容月100。日本時間で月初・0時にリセット)。有料判定は DB の `subscriptions` 表(ユーザーは読むだけ、書込みは SQL Editor か将来の決済 webhook)。**決済は未実装**なので、UI では「準備中」と明記し購入できるように見せない。DB 関数は `begin_ai_request` / `finish_ai_request`(014)。試験は `supabase/tests/usage_limits_test.sql`。Next.js/sharp 更新(0-2)。
- 完了(0-3): Anthropic キー再発行済み・NOTION_* を Vercel から削除済み。ローカル `.env.local` の AI キーは旧キー(無効)なので、ローカルで AI を試すなら新キーに書き換える。AI の返答は `max_tokens` を余裕(1200)で取り、JSON が切れても読める作りにすること(`/api/chat` の `extractReply` 参照)。
- 完了(0-4): セキュリティヘッダー(CSP 含む)を `next.config.ts` に設定、ESLint エラー 0 件。**新しい外部サービス(外部フォント・画像・API 等)を使うときは `next.config.ts` の CSP(`connect-src` / `img-src` 等)に追記しないとブラウザにブロックされる。**
- 完了(0-5/0-6): Supabase Auth(メール確認オン・パスワード10文字以上・Site URL は本番)、`/privacy`・`/terms`、アカウント削除(`delete_my_account` RPC)。**新しい公開ページを作るときは `src/proxy.ts` の `isPublicPage` と `BottomNav` の非表示条件に追加する。新しい個人データを保存するテーブルを足したら、アカウント削除(user_id の on delete cascade)とプライバシーポリシーの文面も更新する。**
- **公開範囲を広げる前の宿題**: Notion トークンの無効化(ユーザー作業)、独自SMTP、CAPTCHA、規約・ポリシーの専門家確認。
- 保留: 間接依存 4 件の脆弱性(zod / js-yaml / brace-expansion / source-map-js。本番の外部入力経路ではない)。

- **フェーズ2(今日のミッション)**: AI を使わず、保存済みプランの `weekly` から日本時間で「何日目」かを計算して1日1つ出す(`src/lib/mission.ts`、`npm test`)。記録は `mission_logs`(完了/お休み・1人1日1件)。ホームは `MissionCard`、マイプランは週間表に✓と進み具合。設計は `docs/05_phase2_design.md`。

- **フェーズ3(AI 相談でプラン調整)**: AI は「差分(patch)」だけを返し、アプリが `plan-patch.ts` で検査・適用・変更前後の比較をして見せ、**ユーザーが承認するまでプランは変わらない**。調整案は `plan_proposals`、承認は `/api/plan/apply`(AI なし)→ DB 関数 `save_adjusted_plan`(元は履歴、`cycle_start` を引き継いでサイクル継続)。相談は専用の回数 `plan_adjust`(無料月5/有料月20)。ミッションの「何日目か」は `plans.cycle_start` から数える。設計は `docs/06_phase3_design.md`。試験は `supabase/tests/plan_adjustment_test.sql`。

## 次の手順
フェーズ0〜2(安全対策・プラン作成・今日のミッション)は完了。`docs/02_roadmap.md` の **フェーズ3(AI 相談でプランを調整。AI は提案だけ、ユーザーが承認してから反映)** から。進捗は `docs/02_roadmap.md` の「進捗メモ」に追記する。
