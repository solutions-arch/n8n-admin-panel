'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'

type BugStatus =
    | 'reported'
    | 'triage'
    | 'in_progress'
    | 'code_review'
    | 'qa_testing'
    | 'rejected'
    | 'released'
    | 'done'

type Severity = 'low' | 'medium' | 'high' | 'critical'

type StatusFilter = 'all' | 'open' | 'closed' | BugStatus
type SeverityFilter = 'all' | 'high_critical' | Severity

type DateRangePreset =
    | 'all_time'
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'last_month'
    | 'this_year'

type SortOption =
    | 'latest_error'
    | 'oldest_error'
    | 'severity_desc'
    | 'workflow_asc'
    | 'status_asc'

type BugLog = {
    execution_id: string
    workflow_id: string | null
    workflow_name: string | null
    workflow_display_name: string

    execution_url: string | null
    mode: string | null
    last_node_executed: string | null

    error_name: string | null
    error_message: string | null
    error_timestamp: string | null

    status: BugStatus
    severity: Severity
    source: string | null

    clickup_task_id: string | null
    clickup_task_url: string | null
    clickup_task_status: string | null
    clickup_task_created_at: string | null

    resolved_at: string | null
    resolved_by: string | null
    resolution_notes: string | null

    created_at: string
    updated_at: string

    workflow_active: boolean | null
    workflow_archived: boolean | null
    workflow_description: string | null
    workflow_tags: string[]
}

const BUG_LOGS_TIME_ZONE = 'America/Chicago'

const STATUS_OPTIONS: BugStatus[] = [
    'reported',
    'triage',
    'in_progress',
    'code_review',
    'qa_testing',
    'rejected',
    'released',
    'done',
]

const SEVERITY_OPTIONS: Severity[] = ['low', 'medium', 'high', 'critical']

const STATUS_LABELS: Record<BugStatus, string> = {
    reported: 'Reported',
    triage: 'Triage',
    in_progress: 'In Progress',
    code_review: 'Code Review',
    qa_testing: 'QA Testing',
    rejected: 'Rejected',
    released: 'Released',
    done: 'Done',
}

const SEVERITY_LABELS: Record<Severity, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
}

function fetchJson(url: string, options?: RequestInit) {
    return fetch(url, options).then(async response => {
        const text = await response.text()
        const data = text ? JSON.parse(text) : {}

        if (!response.ok) {
            throw new Error(data.error || data.detail || 'Request failed')
        }

        return data
    })
}

function formatDate(value: string | null | undefined) {
    if (!value) return '—'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleString('en-US', {
        timeZone: BUG_LOGS_TIME_ZONE,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
}

function padNumber(value: number) {
    return String(value).padStart(2, '0')
}

function getDateInputInTimeZone(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: BUG_LOGS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)

    const month = parts.find(part => part.type === 'month')?.value || '01'
    const day = parts.find(part => part.type === 'day')?.value || '01'
    const year = parts.find(part => part.type === 'year')?.value || '2026'

    return `${year}-${month}-${day}`
}

function parseDateInput(dateInput: string) {
    const [year, month, day] = dateInput.split('-').map(Number)
    return { year, month, day }
}

function formatDateInputFromParts(year: number, month: number, day: number) {
    return `${year}-${padNumber(month)}-${padNumber(day)}`
}

function addDaysToDateInput(dateInput: string, days: number) {
    const { year, month, day } = parseDateInput(dateInput)
    const date = new Date(Date.UTC(year, month - 1, day))

    date.setUTCDate(date.getUTCDate() + days)

    return formatDateInputFromParts(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
    )
}

function getFirstDayOfMonth(dateInput: string) {
    const { year, month } = parseDateInput(dateInput)
    return formatDateInputFromParts(year, month, 1)
}

function getFirstDayOfYear(dateInput: string) {
    const { year } = parseDateInput(dateInput)
    return formatDateInputFromParts(year, 1, 1)
}

function getFirstDayOfPreviousMonth(dateInput: string) {
    const { year, month } = parseDateInput(dateInput)
    const date = new Date(Date.UTC(year, month - 2, 1))

    return formatDateInputFromParts(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
    )
}

function getLastDayOfPreviousMonth(dateInput: string) {
    const { year, month } = parseDateInput(dateInput)
    const date = new Date(Date.UTC(year, month - 1, 0))

    return formatDateInputFromParts(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
    )
}

function getStartOfWeek(dateInput: string) {
    const { year, month, day } = parseDateInput(dateInput)
    const date = new Date(Date.UTC(year, month - 1, day))
    const dayOfWeek = date.getUTCDay()

    return addDaysToDateInput(dateInput, -dayOfWeek)
}

function getDateRangeForPreset(preset: DateRangePreset) {
    const todayInput = getDateInputInTimeZone(new Date())

    if (preset === 'today') {
        return {
            startDateInput: todayInput,
            endDateInput: todayInput,
            label: 'Today',
        }
    }

    if (preset === 'this_week') {
        return {
            startDateInput: getStartOfWeek(todayInput),
            endDateInput: todayInput,
            label: 'This Week',
        }
    }

    if (preset === 'this_month') {
        return {
            startDateInput: getFirstDayOfMonth(todayInput),
            endDateInput: todayInput,
            label: 'This Month',
        }
    }

    if (preset === 'last_month') {
        return {
            startDateInput: getFirstDayOfPreviousMonth(todayInput),
            endDateInput: getLastDayOfPreviousMonth(todayInput),
            label: 'Last Month',
        }
    }

    if (preset === 'this_year') {
        return {
            startDateInput: getFirstDayOfYear(todayInput),
            endDateInput: todayInput,
            label: 'This Year',
        }
    }

    return {
        startDateInput: null,
        endDateInput: null,
        label: 'All Time',
    }
}

function isLogWithinDateRange(
    log: BugLog,
    dateRange: ReturnType<typeof getDateRangeForPreset>
) {
    if (!dateRange.startDateInput || !dateRange.endDateInput) {
        return true
    }

    const timestamp = log.error_timestamp || log.created_at

    if (!timestamp) return false

    const logDateInput = getDateInputInTimeZone(new Date(timestamp))

    return (
        logDateInput >= dateRange.startDateInput &&
        logDateInput <= dateRange.endDateInput
    )
}

function getSeverityRank(severity: Severity) {
    const ranks: Record<Severity, number> = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
    }

    return ranks[severity] || 0
}

function getStatusBadgeClass(status: BugStatus) {
    if (status === 'done' || status === 'released') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
    }

    if (status === 'rejected') {
        return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
    }

    if (
        status === 'in_progress' ||
        status === 'code_review' ||
        status === 'qa_testing'
    ) {
        return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900'
    }

    if (status === 'triage') {
        return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900'
    }

    return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900'
}

function getSeverityBadgeClass(severity: Severity) {
    if (severity === 'critical') {
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-900'
    }

    if (severity === 'high') {
        return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900'
    }

    if (severity === 'medium') {
        return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900'
    }

    return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
}

function MetricCard({
    icon,
    label,
    value,
    helper,
    tone = 'neutral',
    isActive = false,
    onClick,
}: {
    icon: string
    label: string
    value: string
    helper?: string
    tone?: 'neutral' | 'success' | 'warning' | 'danger'
    isActive?: boolean
    onClick?: () => void
}) {
    const toneClasses = {
        neutral: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        success:
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
        warning:
            'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
        danger:
            'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    }

    const content = (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {label}
                </p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
                {helper && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                        {helper}
                    </p>
                )}
            </div>

            <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}
            >
                {icon}
            </div>
        </div>
    )

    const className = `w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition-all dark:bg-gray-900 ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : ''
        } ${isActive
            ? 'border-[#F07D19] ring-2 ring-[#F07D19]/30'
            : 'border-gray-200 dark:border-gray-800'
        }`

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={className}>
                {content}
            </button>
        )
    }

    return <div className={className}>{content}</div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-right font-semibold">{value}</span>
        </div>
    )
}

export default function BugLogsPage() {
    const [bugLogs, setBugLogs] = useState<BugLog[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
    const [workflowFilter, setWorkflowFilter] = useState('all')
    const [sortBy, setSortBy] = useState<SortOption>('latest_error')
    const [dateRangePreset, setDateRangePreset] =
        useState<DateRangePreset>('all_time')
    const [visibleLimit, setVisibleLimit] = useState(15)

    const [updatingExecutionId, setUpdatingExecutionId] =
        useState<string | null>(null)
    const [expandedExecutionId, setExpandedExecutionId] =
        useState<string | null>(null)
    const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

    const selectedDateRange = useMemo(() => {
        return getDateRangeForPreset(dateRangePreset)
    }, [dateRangePreset])

    async function loadBugLogs() {
        try {
            setRefreshing(true)
            setError(null)

            const data = await fetchJson('/api/bug-logs')

            setBugLogs(data.data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load bug logs')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        loadBugLogs()
    }, [])

    useEffect(() => {
        setVisibleLimit(15)
    }, [
        searchQuery,
        statusFilter,
        severityFilter,
        workflowFilter,
        sortBy,
        dateRangePreset,
    ])

    const dateScopedBugLogs = useMemo(() => {
        return bugLogs.filter(log => isLogWithinDateRange(log, selectedDateRange))
    }, [bugLogs, selectedDateRange])

    const workflowOptions = useMemo(() => {
        const unique = new Map<string, string>()

        dateScopedBugLogs.forEach(log => {
            if (!log.workflow_id) return

            unique.set(
                log.workflow_id,
                log.workflow_display_name || log.workflow_name || log.workflow_id
            )
        })

        return Array.from(unique.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [dateScopedBugLogs])

    const summary = useMemo(() => {
        const openStatuses: BugStatus[] = [
            'reported',
            'triage',
            'in_progress',
            'code_review',
            'qa_testing',
        ]

        const closedStatuses: BugStatus[] = ['released', 'done']

        return {
            total: dateScopedBugLogs.length,
            open: dateScopedBugLogs.filter(log =>
                openStatuses.includes(log.status)
            ).length,
            reported: dateScopedBugLogs.filter(log => log.status === 'reported')
                .length,
            highCritical: dateScopedBugLogs.filter(
                log => log.severity === 'high' || log.severity === 'critical'
            ).length,
            done: dateScopedBugLogs.filter(log =>
                closedStatuses.includes(log.status)
            ).length,
        }
    }, [dateScopedBugLogs])

    const filteredBugLogs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return dateScopedBugLogs
            .filter(log => {
                const openStatuses: BugStatus[] = [
                    'reported',
                    'triage',
                    'in_progress',
                    'code_review',
                    'qa_testing',
                ]

                const closedStatuses: BugStatus[] = ['released', 'done']

                if (
                    statusFilter === 'open' &&
                    !openStatuses.includes(log.status)
                ) {
                    return false
                }

                if (
                    statusFilter === 'closed' &&
                    !closedStatuses.includes(log.status)
                ) {
                    return false
                }

                if (
                    statusFilter !== 'all' &&
                    statusFilter !== 'open' &&
                    statusFilter !== 'closed' &&
                    log.status !== statusFilter
                ) {
                    return false
                }

                if (
                    severityFilter === 'high_critical' &&
                    log.severity !== 'high' &&
                    log.severity !== 'critical'
                ) {
                    return false
                }

                if (
                    severityFilter !== 'all' &&
                    severityFilter !== 'high_critical' &&
                    log.severity !== severityFilter
                ) {
                    return false
                }

                if (workflowFilter !== 'all' && log.workflow_id !== workflowFilter) {
                    return false
                }

                if (!query) return true

                const searchable = [
                    log.execution_id,
                    log.workflow_id,
                    log.workflow_name,
                    log.workflow_display_name,
                    log.error_name,
                    log.error_message,
                    log.last_node_executed,
                    log.mode,
                    ...(log.workflow_tags || []),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()

                return searchable.includes(query)
            })
            .sort((a, b) => {
                if (sortBy === 'latest_error') {
                    return (
                        new Date(b.error_timestamp || b.created_at || 0).getTime() -
                        new Date(a.error_timestamp || a.created_at || 0).getTime()
                    )
                }

                if (sortBy === 'oldest_error') {
                    return (
                        new Date(a.error_timestamp || a.created_at || 0).getTime() -
                        new Date(b.error_timestamp || b.created_at || 0).getTime()
                    )
                }

                if (sortBy === 'severity_desc') {
                    return getSeverityRank(b.severity) - getSeverityRank(a.severity)
                }

                if (sortBy === 'workflow_asc') {
                    return String(a.workflow_display_name || '').localeCompare(
                        String(b.workflow_display_name || '')
                    )
                }

                if (sortBy === 'status_asc') {
                    return String(a.status || '').localeCompare(String(b.status || ''))
                }

                return 0
            })
    }, [
        dateScopedBugLogs,
        searchQuery,
        statusFilter,
        severityFilter,
        workflowFilter,
        sortBy,
    ])

    const visibleBugLogs = filteredBugLogs.slice(0, visibleLimit)

    async function updateBugLog(
        executionId: string,
        updates: Record<string, any>
    ) {
        setUpdatingExecutionId(executionId)

        try {
            const response = await fetchJson(`/api/bug-logs/${executionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            })

            const updated = response.data

            setBugLogs(prev =>
                prev.map(log =>
                    log.execution_id === executionId
                        ? {
                            ...log,
                            ...updated,
                        }
                        : log
                )
            )
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to update bug log')
        } finally {
            setUpdatingExecutionId(null)
        }
    }

    function resetFilters() {
        setSearchQuery('')
        setStatusFilter('all')
        setSeverityFilter('all')
        setWorkflowFilter('all')
        setDateRangePreset('all_time')
        setSortBy('latest_error')
        setVisibleLimit(15)
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Loading bug logs...
                </p>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                        🐞 Workflow Issues
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight">
                        Bug Logs
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                        Monitor failed n8n executions, review linked ClickUp tasks,
                        and update bug status from the dashboard.
                    </p>

                    {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                </div>

                <button
                    onClick={loadBugLogs}
                    disabled={refreshing}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                    icon="📌"
                    label="Total Bugs"
                    value={summary.total.toLocaleString()}
                    helper={selectedDateRange.label}
                    isActive={statusFilter === 'all' && severityFilter === 'all'}
                    onClick={() => {
                        setStatusFilter('all')
                        setSeverityFilter('all')
                        setWorkflowFilter('all')
                    }}
                />

                <MetricCard
                    icon="🚨"
                    label="Open Bugs"
                    value={summary.open.toLocaleString()}
                    helper="Reported to QA testing"
                    tone={summary.open > 0 ? 'danger' : 'success'}
                    onClick={() => {
                        setStatusFilter('open')
                        setSeverityFilter('all')
                    }}
                    isActive={statusFilter === 'open'}
                />

                <MetricCard
                    icon="🧭"
                    label="Reported"
                    value={summary.reported.toLocaleString()}
                    helper="Newly captured"
                    tone="warning"
                    onClick={() => {
                        setStatusFilter('reported')
                        setSeverityFilter('all')
                    }}
                    isActive={statusFilter === 'reported' && severityFilter === 'all'}
                />

                <MetricCard
                    icon="🔥"
                    label="High/Critical"
                    value={summary.highCritical.toLocaleString()}
                    helper="Needs attention"
                    tone={summary.highCritical > 0 ? 'danger' : 'neutral'}
                    onClick={() => {
                        setStatusFilter('all')
                        setSeverityFilter('high_critical')
                    }}
                    isActive={severityFilter === 'high_critical'}
                />

                <MetricCard
                    icon="✅"
                    label="Released/Done"
                    value={summary.done.toLocaleString()}
                    helper="Closed issues"
                    tone="success"
                    onClick={() => {
                        setStatusFilter('closed')
                        setSeverityFilter('all')
                    }}
                    isActive={statusFilter === 'closed'}
                />
            </section>

            <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
                    <input
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        placeholder="Search workflow, error, node..."
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] dark:border-gray-700 dark:bg-gray-950 xl:col-span-2"
                    />

                    <select
                        value={statusFilter}
                        onChange={event =>
                            setStatusFilter(event.target.value as StatusFilter)
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] dark:border-gray-700 dark:bg-gray-950"
                    >
                        <option value="all">All statuses</option>
                        <option value="open">Open statuses</option>
                        <option value="closed">Released/Done</option>

                        {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                            </option>
                        ))}
                    </select>

                    <select
                        value={severityFilter}
                        onChange={event =>
                            setSeverityFilter(event.target.value as SeverityFilter)
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] dark:border-gray-700 dark:bg-gray-950"
                    >
                        <option value="all">All severities</option>
                        <option value="high_critical">High/Critical</option>

                        {SEVERITY_OPTIONS.map(severity => (
                            <option key={severity} value={severity}>
                                {SEVERITY_LABELS[severity]}
                            </option>
                        ))}
                    </select>

                    <select
                        value={workflowFilter}
                        onChange={event => setWorkflowFilter(event.target.value)}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] dark:border-gray-700 dark:bg-gray-950"
                    >
                        <option value="all">All workflows</option>

                        {workflowOptions.map(workflow => (
                            <option key={workflow.id} value={workflow.id}>
                                {workflow.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={dateRangePreset}
                        onChange={event =>
                            setDateRangePreset(event.target.value as DateRangePreset)
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] dark:border-gray-700 dark:bg-gray-950"
                    >
                        <option value="all_time">All Time</option>
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                    </select>

                    <select
                        value={sortBy}
                        onChange={event =>
                            setSortBy(event.target.value as SortOption)
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] dark:border-gray-700 dark:bg-gray-950"
                    >
                        <option value="latest_error">Latest error first</option>
                        <option value="oldest_error">Oldest error first</option>
                        <option value="severity_desc">Highest severity first</option>
                        <option value="workflow_asc">Workflow A-Z</option>
                        <option value="status_asc">Status A-Z</option>
                    </select>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {visibleBugLogs.length.toLocaleString()} of{' '}
                        {filteredBugLogs.length.toLocaleString()} bug logs ·{' '}
                        {selectedDateRange.label}
                    </p>

                    <button
                        onClick={resetFilters}
                        className="text-sm font-medium text-[#F07D19] hover:text-[#C85E0B]"
                    >
                        Reset filters
                    </button>
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1150px] text-sm">
                        <thead className="bg-gray-50 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                            <tr>
                                <th className="px-5 py-3 text-left font-medium">
                                    Workflow
                                </th>
                                <th className="px-5 py-3 text-left font-medium">
                                    Error
                                </th>
                                <th className="px-5 py-3 text-left font-medium">
                                    Severity
                                </th>
                                <th className="px-5 py-3 text-left font-medium">
                                    Status
                                </th>
                                <th className="px-5 py-3 text-left font-medium">
                                    Last Node
                                </th>
                                <th className="px-5 py-3 text-left font-medium">
                                    Date
                                </th>
                                <th className="px-5 py-3 text-left font-medium">
                                    Links
                                </th>
                                <th className="px-5 py-3 text-left font-medium">
                                    Manage
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {visibleBugLogs.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        No bug logs found.
                                    </td>
                                </tr>
                            )}

                            {visibleBugLogs.map(log => {
                                const isExpanded =
                                    expandedExecutionId === log.execution_id

                                const notesValue =
                                    notesDraft[log.execution_id] ??
                                    log.resolution_notes ??
                                    ''

                                return (
                                    <Fragment key={log.execution_id}>
                                        <tr className="border-t border-gray-100 transition-colors hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-800/40">
                                            <td className="px-5 py-4">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {log.workflow_display_name}
                                                </div>

                                                <div className="mt-1 font-mono text-xs text-gray-500">
                                                    {log.workflow_id || 'No workflow ID'}
                                                </div>

                                                {log.workflow_tags?.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {log.workflow_tags.map(tag => (
                                                            <span
                                                                key={tag}
                                                                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="max-w-[320px] px-5 py-4">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {log.error_name || 'Unknown error'}
                                                </div>

                                                <div className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                                                    {log.error_message ||
                                                        'No error message.'}
                                                </div>

                                                <div className="mt-1 font-mono text-xs text-gray-400">
                                                    Execution: {log.execution_id}
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getSeverityBadgeClass(log.severity)}`}
                                                >
                                                    {SEVERITY_LABELS[log.severity]}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(log.status)}`}
                                                >
                                                    {STATUS_LABELS[log.status]}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                                                {log.last_node_executed || '—'}
                                            </td>

                                            <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                                                {formatDate(
                                                    log.error_timestamp || log.created_at
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-2">
                                                    {log.execution_url ? (
                                                        <a
                                                            href={log.execution_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                                        >
                                                            Open n8n ↗
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">
                                                            No n8n link
                                                        </span>
                                                    )}

                                                    {log.clickup_task_url ? (
                                                        <a
                                                            href={log.clickup_task_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-medium text-[#F07D19] hover:text-[#C85E0B]"
                                                        >
                                                            Open ClickUp ↗
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">
                                                            No ClickUp task
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex min-w-[190px] flex-col gap-2">
                                                    <select
                                                        value={log.status}
                                                        disabled={
                                                            updatingExecutionId ===
                                                            log.execution_id
                                                        }
                                                        onChange={event =>
                                                            updateBugLog(log.execution_id, {
                                                                status: event.target.value,
                                                            })
                                                        }
                                                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#F07D19] disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950"
                                                    >
                                                        {STATUS_OPTIONS.map(status => (
                                                            <option
                                                                key={status}
                                                                value={status}
                                                            >
                                                                {STATUS_LABELS[status]}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <button
                                                        onClick={() => {
                                                            setExpandedExecutionId(
                                                                isExpanded
                                                                    ? null
                                                                    : log.execution_id
                                                            )

                                                            setNotesDraft(prev => ({
                                                                ...prev,
                                                                [log.execution_id]:
                                                                    prev[
                                                                    log.execution_id
                                                                    ] ??
                                                                    log.resolution_notes ??
                                                                    '',
                                                            }))
                                                        }}
                                                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                                    >
                                                        {isExpanded
                                                            ? 'Hide notes'
                                                            : 'Notes'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="border-t border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-950/60"
                                                >
                                                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                                            <div className="lg:col-span-2">
                                                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                                                    Resolution Notes
                                                                </p>

                                                                <textarea
                                                                    value={notesValue}
                                                                    onChange={event =>
                                                                        setNotesDraft(prev => ({
                                                                            ...prev,
                                                                            [log.execution_id]:
                                                                                event.target
                                                                                    .value,
                                                                        }))
                                                                    }
                                                                    rows={4}
                                                                    placeholder="Add notes about the fix, rejection reason, or next action..."
                                                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] dark:border-gray-700 dark:bg-gray-950"
                                                                />

                                                                <button
                                                                    onClick={() =>
                                                                        updateBugLog(
                                                                            log.execution_id,
                                                                            {
                                                                                resolution_notes:
                                                                                    notesDraft[
                                                                                    log
                                                                                        .execution_id
                                                                                    ] || '',
                                                                            }
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        updatingExecutionId ===
                                                                        log.execution_id
                                                                    }
                                                                    className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                                                                >
                                                                    {updatingExecutionId ===
                                                                        log.execution_id
                                                                        ? 'Saving...'
                                                                        : 'Save notes'}
                                                                </button>
                                                            </div>

                                                            <div className="space-y-3 text-sm">
                                                                <InfoRow
                                                                    label="Resolved At"
                                                                    value={formatDate(
                                                                        log.resolved_at
                                                                    )}
                                                                />
                                                                <InfoRow
                                                                    label="Resolved By"
                                                                    value={
                                                                        log.resolved_by || '—'
                                                                    }
                                                                />
                                                                <InfoRow
                                                                    label="ClickUp Status"
                                                                    value={
                                                                        log.clickup_task_status ||
                                                                        '—'
                                                                    }
                                                                />
                                                                <InfoRow
                                                                    label="Mode"
                                                                    value={log.mode || '—'}
                                                                />
                                                                <InfoRow
                                                                    label="Source"
                                                                    value={
                                                                        log.source || '—'
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredBugLogs.length > visibleLimit && (
                    <div className="flex justify-center border-t border-gray-200 p-5 dark:border-gray-800">
                        <button
                            onClick={() => setVisibleLimit(prev => prev + 15)}
                            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                            Show more bug logs
                        </button>
                    </div>
                )}
            </section>
        </main>
    )
}