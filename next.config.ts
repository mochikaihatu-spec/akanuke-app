import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// ブラウザが「このページが読み込んでよい通信先」を限定するルール(XSSや情報の持ち出し対策)
// 画面の表示用スクリプト/スタイルは Next.js が埋め込むため 'unsafe-inline' が必要(開発中のみ 'unsafe-eval' も)
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl}${isDev ? " ws://localhost:* http://localhost:*" : ""}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // 他のサイトの枠(iframe)に埋め込まれて操作をだまし取られるのを防ぐ
  { key: "X-Frame-Options", value: "DENY" },
  // ファイルの種類をブラウザが勝手に推測して実行するのを防ぐ
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 他のサイトへ移動するとき、URLの詳細を渡さない
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 使わない端末機能(マイク・位置情報など)を無効にする
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // 今後は常に https でアクセスさせる(1年)
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
