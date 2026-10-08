import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'アカヌケ',
    short_name: 'アカヌケ',
    description:
      'ストイックに、自分を分析する。食事・筋トレ・美容をAIと分析して、分かったことを残せるアプリ',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#f8fafc',
  }
}
