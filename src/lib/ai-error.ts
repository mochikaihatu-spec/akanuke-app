// サーバーが返した「ユーザー向けの日本語メッセージ」だけを画面に出すための印
export class AiApiError extends Error {}

export function aiErrorMessage(error: unknown, fallback: string) {
  return error instanceof AiApiError ? error.message : fallback
}
