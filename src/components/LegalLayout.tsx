import Link from 'next/link'

// プライバシーポリシー・利用規約ページの共通の枠
export default function LegalLayout({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <Link href="/login" className="text-sm font-medium text-blue-600">
          ← アカヌケにもどる
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-400">最終更新日: {updatedAt}</p>

        <div className="mt-6 flex flex-col gap-6 rounded-3xl border border-slate-100 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
      {children}
    </section>
  )
}

export const OPERATOR_NAME = 'アカヌケ運営事務局'
export const CONTACT_EMAIL = 'support.akanuke@gmail.com'
