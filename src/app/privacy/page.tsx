import type { Metadata } from 'next'
import LegalLayout, { CONTACT_EMAIL, LegalSection, OPERATOR_NAME } from '@/components/LegalLayout'

export const metadata: Metadata = { title: 'プライバシーポリシー | アカヌケ' }

export default function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー" updatedAt="2026年10月25日">
      <p>
        {OPERATOR_NAME}(以下「運営者」)は、「アカヌケ」(以下「本サービス」)で預かる情報を、このポリシーに従って取り扱います。
        個人が運営する小規模なサービスのため、簡易的な内容です。
      </p>

      <LegalSection heading="1. 預かる情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>アカウント情報: メールアドレス、パスワード(暗号化されて保存され、運営者は読めません)</li>
          <li>プロフィール: 身長、体重、目標体重・目標カロリー・目標タンパク質量、表示するイラストの種類、機能の設定</li>
          <li>記録: 食事の内容・カロリー・食事の写真、体重の履歴、筋トレの記録</li>
          <li>美容相談: 選んだ項目、入力した悩みや相談内容、AIの回答</li>
          <li>AIへの質問(チャット)、AIの利用回数</li>
          <li>ログイン状態を保つための Cookie</li>
        </ul>
        <p>広告や、ユーザーの行動を追跡するための解析ツールは、現在使っていません。</p>
      </LegalSection>

      <LegalSection heading="2. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供(記録の表示、グラフ、AIによるアドバイスの作成)</li>
          <li>不正利用やAIの使いすぎを防ぐための、利用回数の管理</li>
          <li>お問い合わせへの対応、不具合の改善</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 外部サービスへの送信・保管">
        <p>本サービスは、次の外部サービスを利用しており、預かった情報はこれらのサービス上で保管・処理されます。海外のサーバーが含まれる場合があります。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase(データベース・ログイン・写真の保管)</li>
          <li>Vercel(アプリの公開・実行)</li>
          <li>
            Anthropic(AIの回答の作成)。AIに質問したとき、その質問と、回答に必要な記録(食事の内容、目標、体重や筋トレの状況、美容相談の内容、食事の写真など)が送信されます。
          </li>
        </ul>
        <p>法令に基づく場合を除き、これら以外の第三者に、個人を特定できる形で情報を提供することはありません。</p>
      </LegalSection>

      <LegalSection heading="4. 保存期間と削除">
        <p>
          預かった情報は、アカウントを削除するまで保存します。プロフィール画面の「アカウントを削除する」から、いつでもご自身で削除できます。
          削除すると、アカウント、記録、写真、美容相談の履歴、AIの利用回数がすべて消え、元に戻すことはできません。
          (外部サービスのバックアップに、一定期間残る場合があります。)
        </p>
      </LegalSection>

      <LegalSection heading="5. 安全管理">
        <p>
          通信は暗号化(https)されています。ほかのユーザーの記録は、ログインしていても見られないように、データベースで制限しています。
          ただし、インターネット上で絶対に安全な方法はないため、ご自身でもパスワードの管理にご注意ください。
        </p>
      </LegalSection>

      <LegalSection heading="6. 健康・美容に関する情報について">
        <p>
          体重・食事・身体や容姿に関する情報は、デリケートな情報です。必要な範囲でのみ入力してください。
          他の人の個人情報や写真は入力しないでください。
        </p>
      </LegalSection>

      <LegalSection heading="7. 開示・訂正・削除のご請求">
        <p>ご自身の情報の開示・訂正・削除などをご希望の場合は、下記の連絡先までご連絡ください。アカウントの削除は、アプリ内で即時に行えます。</p>
      </LegalSection>

      <LegalSection heading="8. ポリシーの変更">
        <p>内容を変更するときは、このページで知らせます。</p>
      </LegalSection>

      <LegalSection heading="9. お問い合わせ">
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
