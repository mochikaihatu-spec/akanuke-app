import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ログイン情報をクッキーに保存するクライアント(サーバー側のproxy.tsと同じ情報を共有できる)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// いまログインしているユーザーのID。未ログインならnull
export async function getUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
