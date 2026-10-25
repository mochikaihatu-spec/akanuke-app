import type { Metadata } from 'next'
import Link from 'next/link'
import LegalLayout, { CONTACT_EMAIL, LegalSection, OPERATOR_NAME } from '@/components/LegalLayout'

export const metadata: Metadata = { title: '利用規約 | アカヌケ' }

export default function TermsPage() {
  return (
    <LegalLayout title="利用規約" updatedAt="2026年10月25日">
      <p>
        この利用規約(以下「本規約」)は、{OPERATOR_NAME}(以下「運営者」)が提供する「アカヌケ」(以下「本サービス」)の利用条件を定めるものです。
        登録または利用した時点で、本規約に同意したものとみなします。
      </p>

      <LegalSection heading="1. サービスの内容">
        <p>
          本サービスは、食事・体重・筋トレなどの記録と、AIによるアドバイスを提供する、個人が運営するサービスです。
          現在は試験的に提供しており、機能は予告なく変更・追加・終了することがあります。
        </p>
      </LegalSection>

      <LegalSection heading="2. アカウント">
        <ul className="list-disc space-y-1 pl-5">
          <li>登録するメールアドレスは、ご自身が使えるものにしてください。</li>
          <li>パスワードはご自身で管理してください。第三者に使われたことによる損害について、運営者は責任を負いません。</li>
          <li>未成年の方は、保護者の同意を得てご利用ください。</li>
          <li>アカウントは、プロフィール画面からいつでも削除できます。</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. AIによるアドバイスについて(重要)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            AIの回答は、一般的な情報の提供を目的としたもので、<strong>医療行為・診断・治療ではありません</strong>。
            体調や病気、強い不安がある場合は、医師などの専門家に相談してください。
          </li>
          <li>回答の正確性・有用性は保証できません。参考にするかどうかは、ご自身で判断してください。</li>
          <li>食事のカロリーなどの推定値は、写真などからの目安であり、誤差があります。</li>
          <li>AIは、顔や容姿の採点や、特定の人物に似ることの約束はしません。</li>
          <li>安全のため、AIの利用には1日あたりの回数制限があります。</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. 禁止事項">
        <ul className="list-disc space-y-1 pl-5">
          <li>法令や公序良俗に反する行為</li>
          <li>他の人の個人情報・写真を、本人の同意なく入力する行為</li>
          <li>本サービスや外部サービスへの不正アクセス、過度な負荷をかける行為、回数制限をすり抜ける行為</li>
          <li>自動化したプログラムなどで、大量にアクセスする行為</li>
          <li>本サービスの運営を妨げる行為、そのほか運営者が不適切と判断する行為</li>
        </ul>
        <p>違反があった場合、運営者は、事前の通知なく利用を制限したり、アカウントを削除したりすることがあります。</p>
      </LegalSection>

      <LegalSection heading="5. 免責">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            運営者は、本サービスが常に問題なく動くこと(中断・遅延・データの消失がないこと)を保証しません。
            大切な記録は、ご自身でも控えておくことをおすすめします。
          </li>
          <li>
            本サービスの利用によって生じた損害について、運営者の故意または重大な過失による場合を除き、責任を負いません。
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. 個人情報の取り扱い">
        <p>
          個人情報は、<Link href="/privacy" className="font-medium text-blue-600">プライバシーポリシー</Link>に従って取り扱います。
        </p>
      </LegalSection>

      <LegalSection heading="7. 規約の変更・準拠法">
        <p>
          本規約は、必要に応じて変更することがあります。変更後に本サービスを使い続けた場合、変更に同意したものとみなします。
          本規約は日本法に準拠します。
        </p>
      </LegalSection>

      <LegalSection heading="8. お問い合わせ">
        <p>
          運営者: {OPERATOR_NAME}
          <br />
          連絡先:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-blue-600">
            {CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
