'use client'

import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '@/lib/supabase'

type WeightPoint = {
  id: number
  date: string
  weight: number
}

export default function WeightPage() {
  const [points, setPoints] = useState<WeightPoint[]>([])
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      const [recordsResult, profileResult] = await Promise.all([
        supabase
          .from('weight_records')
          .select('id, recorded_at, weight_kg')
          .order('recorded_at', { ascending: true }),
        supabase
          .from('profile')
          .select('target_weight_kg')
          .eq('id', 1)
          .single(),
      ])

      if (recordsResult.data) {
        setPoints(
          recordsResult.data.map((record) => ({
            id: record.id,
            date: new Date(record.recorded_at).toLocaleDateString('ja-JP', {
              month: 'numeric',
              day: 'numeric',
            }),
            weight: Number(record.weight_kg),
          }))
        )
      }
      if (profileResult.data) {
        setTargetWeightKg(
          profileResult.data.target_weight_kg === null
            ? null
            : Number(profileResult.data.target_weight_kg)
        )
      }
      if (recordsResult.error || profileResult.error) {
        setError('データの読み込みに失敗しました')
      }
      setLoading(false)
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-900">
          体重推移
        </h1>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {error && (
            <p className="mb-4 text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          {points.length === 0 ? (
            <p className="text-center text-sm text-zinc-500">
              まだ記録がありません
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={points}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#71717a' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#71717a' }}
                  domain={[
                    (min: number) =>
                      Math.floor(
                        Math.min(min, targetWeightKg ?? min) - 1
                      ),
                    (max: number) =>
                      Math.ceil(
                        Math.max(max, targetWeightKg ?? max) + 1
                      ),
                  ]}
                />
                <Tooltip
                  formatter={(value: unknown) => [`${value} kg`, '体重']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="体重"
                  stroke="#18181b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                {targetWeightKg !== null && (
                  <ReferenceLine
                    y={targetWeightKg}
                    stroke="#ef4444"
                    strokeDasharray="6 4"
                    label={{
                      value: '目標体重',
                      position: 'insideTopRight',
                      fill: '#ef4444',
                      fontSize: 12,
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
