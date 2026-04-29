// app/page.tsx
'use client'

import useSWR from 'swr'
import { useEffect, useMemo, useState } from 'react'

const STATUS_OPTIONS = ['all', 'success', 'error', 'canceled', 'running', 'waiting']
const INITIAL_LIMIT = 50

function StatCard({
  label,
  value,
  color,
  darkMode,
}: {
  label: string
  value: number | string
  color: string
  darkMode: boolean
}) {
  return (
    <div
      className={`rounded-xl p-5 shadow-sm border transition-colors ${darkMode
        ? 'bg-gray-900 border-gray-800 shadow-black/20'
        : 'bg-white border-gray-100'
        }`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wider mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'
          }`}
      >
        {label}
      </p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function DashboardSkeleton({ darkMode }: { darkMode: boolean }) {
  return (
    <div className={`p-8 min-h-full ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className="mb-8">
        <div
          className={`h-8 w-56 rounded animate-pulse mb-2 ${darkMode ? 'bg-gray-800' : 'bg-gray-200'
            }`}
        />
        <div
          className={`h-4 w-72 rounded animate-pulse ${darkMode ? 'bg-gray-900' : 'bg-gray-100'
            }`}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className={`h-28 rounded-xl animate-pulse ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} />
        <div className={`h-28 rounded-xl animate-pulse ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} />
        <div className={`h-28 rounded-xl animate-pulse ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} />
        <div className={`h-28 rounded-xl animate-pulse ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} />
      </div>

      <div className={`h-96 rounded-xl animate-pulse ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`} />
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
  const [darkMode, setDarkMode] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [extraExecutions, setExtraExecutions] = useState<any[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('n8n-admin-theme')

    if (savedTheme === 'dark') {
      setDarkMode(true)
    }

    if (savedTheme === 'light') {
      setDarkMode(false)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('n8n-admin-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

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

  const scopedExecutions = useMemo(() => {
    return executions.filter(
      ex => workflowFilter === 'all' || ex.workflowId === workflowFilter
    )
  }, [executions, workflowFilter])

  const filtered = useMemo(() => {
    return scopedExecutions.filter(
      ex => statusFilter === 'all' || ex.status === statusFilter
    )
  }, [scopedExecutions, statusFilter])

  const total = scopedExecutions.length

  const totalSuccess = useMemo(() => {
    return scopedExecutions.filter(ex => ex.status === 'success').length
  }, [scopedExecutions])

  const totalErrors = useMemo(() => {
    return scopedExecutions.filter(ex => ex.status === 'error').length
  }, [scopedExecutions])

  const totalRunning = useMemo(() => {
    return scopedExecutions.filter(
      ex => ex.status === 'running' || ex.status === 'waiting'
    ).length
  }, [scopedExecutions])

  const successRate =
    total > 0 ? `${Math.round((totalSuccess / total) * 100)}%` : '—'

  const healthBanner = useMemo(() => {
    if (total === 0) {
      return {
        type: 'neutral',
        icon: 'ℹ️',
        title: 'No executions loaded',
        message: 'There are no loaded executions to summarize yet.',
      }
    }

    const errorRate = totalErrors / total

    if (totalErrors >= 3 && errorRate >= 0.1) {
      return {
        type: 'critical',
        icon: '🚨',
        title: 'Critical attention needed',
        message: `${totalErrors} errors detected in the latest ${total} loaded executions.`,
      }
    }

    if (totalErrors > 0) {
      return {
        type: 'warning',
        icon: '⚠️',
        title: 'Needs attention',
        message: `${totalErrors} error${totalErrors === 1 ? '' : 's'} detected in the latest ${total} loaded executions.`,
      }
    }

    if (totalRunning > 0) {
      return {
        type: 'active',
        icon: '🔄',
        title: 'Active executions',
        message: `${totalRunning} execution${totalRunning === 1 ? ' is' : 's are'} currently running or waiting.`,
      }
    }

    return {
      type: 'healthy',
      icon: '✅',
      title: 'Healthy',
      message: `No errors detected in the latest ${total} loaded executions.`,
    }
  }, [total, totalErrors, totalRunning])

  const healthBannerClasses = useMemo(() => {
    if (darkMode) {
      if (healthBanner.type === 'critical') return 'bg-red-950/60 border-red-900 text-red-100'
      if (healthBanner.type === 'warning') return 'bg-amber-950/60 border-amber-900 text-amber-100'
      if (healthBanner.type === 'active') return 'bg-blue-950/60 border-blue-900 text-blue-100'
      if (healthBanner.type === 'healthy') return 'bg-emerald-950/60 border-emerald-900 text-emerald-100'
      return 'bg-gray-900 border-gray-800 text-gray-100'
    }

    if (healthBanner.type === 'critical') return 'bg-red-50 border-red-100 text-red-800'
    if (healthBanner.type === 'warning') return 'bg-amber-50 border-amber-100 text-amber-800'
    if (healthBanner.type === 'active') return 'bg-blue-50 border-blue-100 text-blue-800'
    if (healthBanner.type === 'healthy') return 'bg-green-50 border-green-100 text-green-800'
    return 'bg-gray-50 border-gray-100 text-gray-700'
  }, [darkMode, healthBanner.type])

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

  const workflowBreakdown = useMemo(() => {
    return Object.entries(
      executions.reduce((acc: any, ex) => {
        const name = workflowMap[ex.workflowId] || ex.workflowId || 'Unknown Workflow'

        if (!acc[name]) {
          acc[name] = {
            success: 0,
            error: 0,
            total: 0,
          }
        }

        acc[name].total++

        if (ex.status === 'success') acc[name].success++
        if (ex.status === 'error') acc[name].error++

        return acc
      }, {})
    )
      .sort((a: any, b: any) => b[1].total - a[1].total)
      .slice(0, 5)
  }, [executions, workflowMap])

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

  const errorMessage = execError
    ? 'Failed to load executions. Please check your API route or n8n connection.'
    : manualError

  if (loadingExecutions && !execData) {
    return <DashboardSkeleton darkMode={darkMode} />
  }

  if (errorMessage && executions.length === 0) {
    return (
      <div
        className={`flex h-full items-center justify-center ${darkMode ? 'bg-gray-950' : 'bg-gray-50'
          }`}
      >
        <div
          className={`rounded-xl border shadow-sm p-6 max-w-md text-center ${darkMode
            ? 'bg-gray-900 border-red-900'
            : 'bg-white border-red-100'
            }`}
        >
          <p className="text-red-600 font-semibold mb-2">Dashboard Error</p>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {errorMessage}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`p-8 min-h-full transition-colors ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'
        }`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2
            className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'
              }`}
          >
            {workflowFilter === 'all'
              ? 'All Executions'
              : workflowMap[workflowFilter] || workflowFilter}
          </h2>

          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
            Showing {filtered.length} of {executions.length} loaded executions
            {loadingWorkflows && ' · Loading workflow names...'}
            {' · '}
            Last updated {formatLastUpdated(lastUpdated)}
          </p>

          {errorMessage && (
            <p className="text-sm text-red-500 mt-2">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${darkMode
              ? 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
              }`}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          <button
            onClick={refreshDashboard}
            disabled={refreshing}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${darkMode
              ? 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
              }`}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Compact Health Banner */}
      <div className={`mb-8 rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${healthBannerClasses}`}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{healthBanner.icon}</span>
          <div>
            <p className="text-sm font-semibold">{healthBanner.title}</p>
            <p className="text-sm opacity-80">{healthBanner.message}</p>
          </div>
        </div>

        {totalErrors > 0 && (
          <button
            onClick={() => setStatusFilter('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${darkMode
              ? 'border-white/10 bg-white/10 hover:bg-white/20'
              : 'border-black/5 bg-white/70 hover:bg-white'
              }`}
          >
            Show errors
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total"
          value={total}
          color={darkMode ? 'text-white' : 'text-gray-900'}
          darkMode={darkMode}
        />
        <StatCard
          label="Success"
          value={totalSuccess}
          color="text-green-500"
          darkMode={darkMode}
        />
        <StatCard
          label="Errors"
          value={totalErrors}
          color="text-red-500"
          darkMode={darkMode}
        />
        <StatCard
          label="Success Rate"
          value={successRate}
          color="text-blue-500"
          darkMode={darkMode}
        />
      </div>

      {/* Workflow Breakdown */}
      {workflowFilter === 'all' && (
        <div
          className={`rounded-xl border shadow-sm p-5 mb-8 transition-colors ${darkMode
            ? 'bg-gray-900 border-gray-800 shadow-black/20'
            : 'bg-white border-gray-100'
            }`}
        >
          <div
            className={`mb-5 border-b pb-4 ${darkMode ? 'border-gray-800' : 'border-gray-100'
              }`}
          >
            <div className="flex items-center gap-3">
              <h3
                className={`text-xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'
                  }`}
              >
                Workflow Breakdown
              </h3>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${darkMode
                    ? 'bg-gray-800 text-gray-300 border border-gray-700'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
              >
                Top 5
              </span>
            </div>

            <p
              className={`mt-1 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'
                }`}
            >
              Top 5 most active workflows from the latest {executions.length} loaded executions.
            </p>
          </div>

          <div className="space-y-3">
            {workflowBreakdown.length === 0 ? (
              <p className={`text-sm ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                No workflow data available
              </p>
            ) : (
              workflowBreakdown.map(([name, stats]: any) => (
                <div key={name} className="flex items-center gap-3">
                  <span
                    className={`text-sm w-52 truncate ${darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    title={name}
                  >
                    {name}
                  </span>

                  <div
                    className={`flex-1 rounded-full h-2 overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-100'
                      }`}
                  >
                    <div
                      className="h-2 rounded-full bg-green-400"
                      style={{
                        width: `${Math.round((stats.total / maxTotal) * 100)}%`,
                      }}
                    />
                  </div>

                  <span className={`text-xs w-16 text-right ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {stats.total} runs
                  </span>

                  {stats.error > 0 && (
                    <span className="text-xs text-red-500 w-12">
                      {stats.error} err
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Workflow Filter */}
      <div className="mb-4">
        <select
          value={workflowFilter}
          onChange={e => setWorkflowFilter(e.target.value)}
          className={`px-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-colors ${darkMode
            ? 'bg-gray-900 border-gray-700 text-gray-200 focus:ring-gray-700'
            : 'bg-white border-gray-200 text-gray-700 focus:ring-gray-300'
            }`}
        >
          <option value="all">All Workflows</option>

          {uniqueWorkflows.map(wf => (
            <option key={wf.id} value={wf.id}>
              {wf.name}
            </option>
          ))}
        </select>

        {workflowFilter !== 'all' && (
          <button
            onClick={() => setWorkflowFilter('all')}
            className={`ml-2 text-sm underline ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'
              }`}
          >
            Clear
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_OPTIONS.map(status => {
          const count =
            status === 'all'
              ? total
              : scopedExecutions.filter(ex => ex.status === status).length

          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${statusFilter === status
                ? darkMode
                  ? 'bg-white text-gray-950 border-white'
                  : 'bg-gray-900 text-white border-gray-900'
                : darkMode
                  ? 'bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
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
      <div
        className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${darkMode
          ? 'bg-gray-900 border-gray-800 shadow-black/20'
          : 'bg-white border-gray-100'
          }`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className={`border-b ${darkMode
                ? 'bg-gray-800/60 border-gray-800'
                : 'bg-gray-50 border-gray-100'
                }`}
            >
              <th className={`p-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                ID
              </th>
              <th className={`p-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Workflow
              </th>
              <th className={`p-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Status
              </th>
              <th className={`p-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Mode
              </th>
              <th className={`p-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Duration
              </th>
              <th className={`p-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Started At
              </th>
              <th className={`p-4 text-left text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Action
              </th>
            </tr>
          </thead>

          <tbody className={darkMode ? 'divide-y divide-gray-800' : 'divide-y divide-gray-50'}>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className={`p-8 text-center ${darkMode ? 'text-gray-600' : 'text-gray-300'
                    }`}
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
                      ? darkMode
                        ? 'bg-red-950/30 hover:bg-red-950/50'
                        : 'bg-red-50 hover:bg-red-100'
                      : darkMode
                        ? 'hover:bg-gray-800/60'
                        : 'hover:bg-gray-50'
                      }`}
                  >
                    <td className={`p-4 font-mono text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {ex.id}
                    </td>

                    <td className="p-4">
                      <span
                        className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'
                          }`}
                      >
                        {workflowName}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ex.status === 'success'
                          ? darkMode
                            ? 'bg-green-950 text-green-300'
                            : 'bg-green-100 text-green-700'
                          : ex.status === 'error'
                            ? darkMode
                              ? 'bg-red-950 text-red-300'
                              : 'bg-red-100 text-red-700'
                            : ex.status === 'running'
                              ? darkMode
                                ? 'bg-blue-950 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                              : darkMode
                                ? 'bg-yellow-950 text-yellow-300'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                      >
                        {ex.status || 'unknown'}
                      </span>
                    </td>

                    <td className={`p-4 capitalize ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {ex.mode || '—'}
                    </td>

                    <td className={`p-4 font-mono text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {ex.startedAt && ex.stoppedAt
                        ? duration(ex.startedAt, ex.stoppedAt)
                        : '—'}
                    </td>

                    <td className={`p-4 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
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
                          className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${darkMode
                            ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                          title="Open execution in n8n"
                        >
                          Open ↗
                        </a>
                      ) : (
                        <span className={`text-xs ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
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
            className={`px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${darkMode
              ? 'bg-white text-gray-950 hover:bg-gray-200'
              : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {!nextCursor && executions.length > 0 && (
        <p className={`mt-6 text-center text-sm ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
          All {executions.length} executions loaded
        </p>
      )}
    </div>
  )
}