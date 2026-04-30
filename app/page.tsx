// app/page.tsx
'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState } from 'react'

const STATUS_OPTIONS = ['all', 'success', 'error', 'canceled', 'waiting']
const INITIAL_LIMIT = 50

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All loaded' },
  { value: 'today', label: 'Today' },
  { value: 'last24h', label: 'Last 24 hours' },
  { value: 'last7d', label: 'Last 7 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
]

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-gray-50 p-8 dark:bg-gray-950">
      <div className="mb-8">
        <div className="mb-2 h-8 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-72 animate-pulse rounded bg-gray-100 dark:bg-gray-900" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
      </div>

      <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
    </div>
  )
}

function duration(startedAt: string, stoppedAt: string) {
  const ms = new Date(stoppedAt).getTime() - new Date(startedAt).getTime()

  if (Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`

  return `${(ms / 60000).toFixed(1)}m`
}

function getN8nExecutionUrl(execution: any) {
  const editorUrl = process.env.NEXT_PUBLIC_N8N_EDITOR_URL

  if (!editorUrl || !execution.workflowId || !execution.id) {
    return null
  }

  const cleanEditorUrl = editorUrl.replace(/\/$/, '')

  return `${cleanEditorUrl}/workflow/${execution.workflowId}/executions/${execution.id}`
}

function formatLastUpdated(date: Date | null) {
  if (!date) return 'Not yet updated'

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatModeLabel(mode: string) {
  if (!mode) return 'Unknown'
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

function matchesDateFilter(
  startedAt: string | null | undefined,
  dateFilter: string,
  customStartDate: string,
  customEndDate: string
) {
  if (dateFilter === 'all') return true
  if (!startedAt) return false

  const startedDate = new Date(startedAt)

  if (Number.isNaN(startedDate.getTime())) return false

  const now = new Date()

  if (dateFilter === 'today') {
    return (
      startedDate.getFullYear() === now.getFullYear() &&
      startedDate.getMonth() === now.getMonth() &&
      startedDate.getDate() === now.getDate()
    )
  }

  if (dateFilter === 'last24h') {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    return startedDate.getTime() >= oneDayAgo
  }

  if (dateFilter === 'last7d') {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return startedDate.getTime() >= sevenDaysAgo
  }

  if (dateFilter === 'thisMonth') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return startedDate >= startOfMonth && startedDate <= now
  }

  if (dateFilter === 'custom') {
    if (!customStartDate && !customEndDate) return true

    let startDate: Date | null = null
    let endDate: Date | null = null

    if (customStartDate) {
      startDate = new Date(`${customStartDate}T00:00:00`)
    }

    if (customEndDate) {
      endDate = new Date(`${customEndDate}T23:59:59.999`)
    }

    if (startDate && startedDate < startDate) return false
    if (endDate && startedDate > endDate) return false

    return true
  }

  return true
}

function getDateFilterLabel(
  dateFilter: string,
  customStartDate = '',
  customEndDate = ''
) {
  if (dateFilter === 'custom') {
    if (customStartDate && customEndDate) {
      return `${customStartDate} to ${customEndDate}`
    }

    if (customStartDate) {
      return `From ${customStartDate}`
    }

    if (customEndDate) {
      return `Until ${customEndDate}`
    }

    return 'Custom range'
  }

  return DATE_FILTER_OPTIONS.find(option => option.value === dateFilter)?.label || 'All loaded'
}

async function fetchJson(url: string) {
  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Request failed: ${res.status} ${text}`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

export default function Home() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [extraExecutions, setExtraExecutions] = useState<any[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const {
    data: execData,
    error: execError,
    isLoading: loadingExecutions,
    mutate: refreshExecutions,
  } = useSWR(`/api/executions?limit=${INITIAL_LIMIT}`, fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    refreshInterval: extraExecutions.length === 0 ? 30000 : 0,
    keepPreviousData: true,
  })

  const {
    data: workflowData,
    isLoading: loadingWorkflows,
    mutate: refreshWorkflows,
  } = useSWR('/api/workflows', fetchJson, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    refreshInterval: 60000,
    keepPreviousData: true,
  })

  useEffect(() => {
    if (execData) {
      setLastUpdated(new Date())

      if (extraExecutions.length === 0) {
        setNextCursor(execData.nextCursor || null)
      }
    }
  }, [execData, extraExecutions.length])

  const baseExecutions = useMemo(() => {
    return execData?.data || []
  }, [execData])

  const executions = useMemo(() => {
    const combined = [...baseExecutions, ...extraExecutions]
    const map = new Map<string, any>()

    for (const ex of combined) {
      map.set(String(ex.id), ex)
    }

    return Array.from(map.values()).sort(
      (a: any, b: any) => Number(b.id) - Number(a.id)
    )
  }, [baseExecutions, extraExecutions])

  const workflowMap = useMemo(() => {
    const map: Record<string, string> = {}

    for (const wf of workflowData?.data || []) {
      map[wf.id] = wf.name
    }

    return map
  }, [workflowData])

  const dateFilteredExecutions = useMemo(() => {
    return executions.filter(ex =>
      matchesDateFilter(ex.startedAt, dateFilter, customStartDate, customEndDate)
    )
  }, [executions, dateFilter, customStartDate, customEndDate])

  const workflowScopedExecutions = useMemo(() => {
    return dateFilteredExecutions.filter(
      ex => workflowFilter === 'all' || ex.workflowId === workflowFilter
    )
  }, [dateFilteredExecutions, workflowFilter])

  const modeScopedExecutions = useMemo(() => {
    return workflowScopedExecutions.filter(
      ex => modeFilter === 'all' || ex.mode === modeFilter
    )
  }, [workflowScopedExecutions, modeFilter])

  const filtered = useMemo(() => {
    return modeScopedExecutions.filter(
      ex => statusFilter === 'all' || ex.status === statusFilter
    )
  }, [modeScopedExecutions, statusFilter])

  const total = modeScopedExecutions.length

  const totalSuccess = useMemo(() => {
    return modeScopedExecutions.filter(ex => ex.status === 'success').length
  }, [modeScopedExecutions])

  const totalErrors = useMemo(() => {
    return modeScopedExecutions.filter(ex => ex.status === 'error').length
  }, [modeScopedExecutions])

  const totalCanceled = useMemo(() => {
    return modeScopedExecutions.filter(ex => ex.status === 'canceled').length
  }, [modeScopedExecutions])

  const totalWaiting = useMemo(() => {
    return modeScopedExecutions.filter(ex => ex.status === 'waiting').length
  }, [modeScopedExecutions])

  const successRate =
    total > 0 ? `${Math.round((totalSuccess / total) * 100)}%` : '—'

  const healthBanner = useMemo(() => {
    if (total === 0) {
      return {
        type: 'neutral',
        icon: 'ℹ️',
        title: 'No executions found',
        message: 'No executions match the current filters.',
      }
    }

    const errorRate = totalErrors / total

    if (totalErrors >= 3 && errorRate >= 0.1) {
      return {
        type: 'critical',
        icon: '🚨',
        title: 'Critical attention needed',
        message: `${totalErrors} errors detected in the current filtered view.`,
      }
    }

    if (totalErrors > 0) {
      return {
        type: 'warning',
        icon: '⚠️',
        title: 'Needs attention',
        message: `${totalErrors} error${totalErrors === 1 ? '' : 's'} detected in the current filtered view.`,
      }
    }

    if (totalWaiting > 0) {
      return {
        type: 'active',
        icon: '⏳',
        title: 'Waiting executions',
        message: `${totalWaiting} execution${totalWaiting === 1 ? ' is' : 's are'} currently waiting.`,
      }
    }

    return {
      type: 'healthy',
      icon: '✅',
      title: 'Healthy',
      message: 'No errors detected in the current filtered view.',
    }
  }, [total, totalErrors, totalWaiting])

  const healthBannerClasses = useMemo(() => {
    if (healthBanner.type === 'critical') {
      return 'bg-red-50 border-red-100 text-red-800 dark:bg-red-950/60 dark:border-red-900 dark:text-red-100'
    }

    if (healthBanner.type === 'warning') {
      return 'bg-amber-50 border-amber-100 text-amber-800 dark:bg-amber-950/60 dark:border-amber-900 dark:text-amber-100'
    }

    if (healthBanner.type === 'active') {
      return 'bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-950/60 dark:border-blue-900 dark:text-blue-100'
    }

    if (healthBanner.type === 'healthy') {
      return 'bg-green-50 border-green-100 text-green-800 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-100'
    }

    return 'bg-gray-50 border-gray-100 text-gray-700 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100'
  }, [healthBanner.type])

  const uniqueWorkflows = useMemo(() => {
    const ids = Array.from(
      new Set(executions.map(ex => ex.workflowId).filter(Boolean))
    ) as string[]

    return ids
      .map(id => ({
        id,
        name: workflowMap[id] || id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [executions, workflowMap])

  const modeOptions = useMemo(() => {
    const modes = Array.from(
      new Set(executions.map(ex => ex.mode).filter(Boolean))
    ) as string[]

    return modes.sort((a, b) => a.localeCompare(b))
  }, [executions])

  const workflowBreakdownSource = useMemo(() => {
    return dateFilteredExecutions.filter(
      ex => modeFilter === 'all' || ex.mode === modeFilter
    )
  }, [dateFilteredExecutions, modeFilter])

  const workflowBreakdown = useMemo(() => {
    return Object.entries(
      workflowBreakdownSource.reduce((acc: any, ex) => {
        const name = workflowMap[ex.workflowId] || ex.workflowId || 'Unknown Workflow'

        if (!acc[name]) {
          acc[name] = {
            success: 0,
            error: 0,
            waiting: 0,
            total: 0,
          }
        }

        acc[name].total++

        if (ex.status === 'success') acc[name].success++
        if (ex.status === 'error') acc[name].error++
        if (ex.status === 'waiting') acc[name].waiting++

        return acc
      }, {})
    )
      .sort((a: any, b: any) => b[1].total - a[1].total)
      .slice(0, 5)
  }, [workflowBreakdownSource, workflowMap])

  const maxTotal =
    workflowBreakdown.length > 0 ? (workflowBreakdown[0][1] as any).total : 1

  const loadMore = async () => {
    if (!nextCursor) return

    setLoadingMore(true)
    setManualError(null)

    try {
      const data = await fetchJson(
        `/api/executions?cursor=${nextCursor}&limit=${INITIAL_LIMIT}`
      )

      setExtraExecutions(prev => {
        const existingIds = new Set([
          ...baseExecutions.map((ex: any) => String(ex.id)),
          ...prev.map((ex: any) => String(ex.id)),
        ])

        const newOnes = (data.data || []).filter(
          (ex: any) => !existingIds.has(String(ex.id))
        )

        return [...prev, ...newOnes].sort(
          (a: any, b: any) => Number(b.id) - Number(a.id)
        )
      })

      setNextCursor(data.nextCursor || null)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to load more:', error)
      setManualError('Failed to load more executions.')
    } finally {
      setLoadingMore(false)
    }
  }

  const refreshDashboard = async () => {
    setRefreshing(true)
    setManualError(null)
    setExtraExecutions([])
    setNextCursor(null)

    try {
      await Promise.all([
        refreshExecutions(),
        refreshWorkflows(),
      ])

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to refresh dashboard:', error)
      setManualError('Failed to refresh dashboard.')
    } finally {
      setRefreshing(false)
    }
  }

  const clearFilters = () => {
    setWorkflowFilter('all')
    setModeFilter('all')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setStatusFilter('all')
  }

  const errorMessage = execError
    ? 'Failed to load executions. Please check your API route or n8n connection.'
    : manualError

  if (loadingExecutions && !execData) {
    return <DashboardSkeleton />
  }

  if (errorMessage && executions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md rounded-xl border border-red-100 bg-white p-6 text-center shadow-sm dark:border-red-900 dark:bg-gray-900">
          <p className="mb-2 font-semibold text-red-600">Dashboard Error</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {errorMessage}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 p-8 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {workflowFilter === 'all'
              ? 'All Executions'
              : workflowMap[workflowFilter] || workflowFilter}
          </h2>

          <p className="mt-1 text-sm text-gray-400 dark:text-gray-400">
            Showing {filtered.length} of {executions.length} loaded executions
            {dateFilter !== 'all' &&
              ` · Date filter: ${getDateFilterLabel(dateFilter, customStartDate, customEndDate)}`}
            {modeFilter !== 'all' &&
              ` · Mode: ${formatModeLabel(modeFilter)}`}
            {loadingWorkflows && ' · Loading workflow names...'}
            {' · '}
            Last updated {formatLastUpdated(lastUpdated)}
          </p>

          {errorMessage && (
            <p className="mt-2 text-sm text-red-500">
              {errorMessage}
            </p>
          )}
        </div>

        <button
          onClick={refreshDashboard}
          disabled={refreshing}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Compact Health Banner */}
      <div className={`mb-8 flex items-center justify-between gap-4 rounded-xl border px-5 py-4 ${healthBannerClasses}`}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{healthBanner.icon}</span>
          <div>
            <p className="text-sm font-semibold">{healthBanner.title}</p>
            <p className="text-sm opacity-80">{healthBanner.message}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {totalErrors > 0 && (
            <button
              onClick={() => setStatusFilter('error')}
              className="rounded-lg border border-black/5 bg-white/70 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
            >
              Show errors
            </button>
          )}

          {totalWaiting > 0 && (
            <button
              onClick={() => setStatusFilter('waiting')}
              className="rounded-lg border border-black/5 bg-white/70 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
            >
              Show waiting
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total"
          value={total}
          color="text-gray-900 dark:text-white"
        />
        <StatCard
          label="Success"
          value={totalSuccess}
          color="text-green-500"
        />
        <StatCard
          label="Errors"
          value={totalErrors}
          color="text-red-500"
        />
        <StatCard
          label="Waiting"
          value={totalWaiting}
          color="text-blue-500"
        />
        <StatCard
          label="Success Rate"
          value={successRate}
          color="text-blue-500"
        />
      </div>

      {/* Workflow Breakdown */}
      {workflowFilter === 'all' && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20">
          <div className="mb-5 border-b border-gray-100 pb-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Workflow Breakdown
              </h3>

              <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Top 5
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Top 5 most active workflows from the current loaded executions
              {dateFilter !== 'all' &&
                ` filtered by ${getDateFilterLabel(dateFilter, customStartDate, customEndDate)}`}
              {modeFilter !== 'all' &&
                ` · Mode: ${formatModeLabel(modeFilter)}`}
              .
            </p>
          </div>

          <div className="space-y-3">
            {workflowBreakdown.length === 0 ? (
              <p className="text-sm text-gray-300 dark:text-gray-600">
                No workflow data available
              </p>
            ) : (
              workflowBreakdown.map(([name, stats]: any) => (
                <div key={name} className="flex items-center gap-3">
                  <span
                    className="w-52 truncate text-sm text-gray-600 dark:text-gray-300"
                    title={name}
                  >
                    {name}
                  </span>

                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-2 rounded-full bg-green-400"
                      style={{
                        width: `${Math.round((stats.total / maxTotal) * 100)}%`,
                      }}
                    />
                  </div>

                  <span className="w-16 text-right text-xs text-gray-400 dark:text-gray-500">
                    {stats.total} runs
                  </span>

                  {stats.error > 0 && (
                    <span className="w-12 text-xs text-red-500">
                      {stats.error} err
                    </span>
                  )}

                  {stats.waiting > 0 && (
                    <span className="w-16 text-xs text-blue-500">
                      {stats.waiting} waiting
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={workflowFilter}
          onChange={e => setWorkflowFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-700"
        >
          <option value="all">All Workflows</option>

          {uniqueWorkflows.map(wf => (
            <option key={wf.id} value={wf.id}>
              {wf.name}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-700"
        >
          {DATE_FILTER_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={modeFilter}
          onChange={e => setModeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-700"
        >
          <option value="all">All Modes</option>

          {modeOptions.map(mode => (
            <option key={mode} value={mode}>
              {formatModeLabel(mode)}
            </option>
          ))}
        </select>

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-700"
            />

            <span className="text-sm text-gray-400 dark:text-gray-500">
              to
            </span>

            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:ring-gray-700"
            />
          </div>
        )}

        {(workflowFilter !== 'all' ||
          dateFilter !== 'all' ||
          modeFilter !== 'all' ||
          statusFilter !== 'all') && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-400 underline hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Clear filters
            </button>
          )}
      </div>

      {/* Status Filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(status => {
          const count =
            status === 'all'
              ? total
              : modeScopedExecutions.filter(ex => ex.status === status).length

          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${statusFilter === status
                  ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-950'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500'
                }`}
            >
              {status === 'all'
                ? 'All'
                : status.charAt(0).toUpperCase() + status.slice(1)}{' '}
              ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/60">
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                ID
              </th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Workflow
              </th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Status
              </th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Mode
              </th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Duration
              </th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Started At
              </th>
              <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-gray-300 dark:text-gray-600"
                >
                  No executions found
                </td>
              </tr>
            ) : (
              filtered.map((ex, index) => {
                const executionUrl = getN8nExecutionUrl(ex)
                const workflowName =
                  workflowMap[ex.workflowId] || ex.workflowId || 'Unknown Workflow'

                return (
                  <tr
                    key={`${ex.id}-${index}`}
                    className={`transition-colors ${ex.status === 'error'
                        ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50'
                        : ex.status === 'waiting'
                          ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      }`}
                  >
                    <td className="p-4 font-mono text-xs text-gray-400 dark:text-gray-500">
                      {ex.id}
                    </td>

                    <td className="p-4">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {workflowName}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ex.status === 'success'
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : ex.status === 'error'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                              : ex.status === 'waiting'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : ex.status === 'canceled'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                      >
                        {ex.status || 'unknown'}
                      </span>
                    </td>

                    <td className="p-4 capitalize text-gray-500 dark:text-gray-400">
                      {ex.mode || '—'}
                    </td>

                    <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {ex.startedAt && ex.stoppedAt
                        ? duration(ex.startedAt, ex.stoppedAt)
                        : '—'}
                    </td>

                    <td className="p-4 text-xs text-gray-400 dark:text-gray-500">
                      {ex.startedAt
                        ? new Date(ex.startedAt).toLocaleString()
                        : '—'}
                    </td>

                    <td className="p-4">
                      {executionUrl ? (
                        <a
                          href={executionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                          title="Open execution in n8n"
                        >
                          Open ↗
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {!nextCursor && executions.length > 0 && (
        <p className="mt-6 text-center text-sm text-gray-300 dark:text-gray-600">
          All {executions.length} executions loaded
        </p>
      )}
    </div>
  )
}