// app/operations/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type OperationsSummary = {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    waitingExecutions: number
    otherExecutions: number
    successRate: number
    totalTimeSavedMinutes: number
    totalHoursSaved: number
    totalWorkdaysSaved: number
    avgTimeSavedPerSuccessfulExecution: number
    avgTimeSavedPerTimeSavingExecution?: number
    totalDurationSeconds: number
    timeSavingExecutions?: number
}

type WorkflowMetric = {
    workflow_id: string | null
    workflow_name: string
    total_executions: number
    successful_executions: number
    failed_or_other_executions: number
    time_saving_executions?: number
    total_time_saved_minutes: number
    total_time_saved_hours: number
    total_duration_seconds: number
    avg_time_saved_minutes: number
    avg_time_saved_per_time_saving_execution?: number
    success_rate: number
    last_started_at: string | null
}

type SortOption =
    | 'time_saved_desc'
    | 'time_saved_asc'
    | 'executions_desc'
    | 'success_rate_desc'
    | 'success_rate_asc'
    | 'latest_run_desc'
    | 'workflow_name_asc'
    | 'failures_desc'

type ImpactFilter =
    | 'all'
    | 'successful_workflows'
    | 'with_time_saved'
    | 'no_time_saved'
    | 'has_failures'
    | 'low_success_rate'
    | 'needs_attention'

type DateRangePreset =
    | 'all_time'
    | 'today'
    | 'last_7_days'
    | 'this_month'
    | 'last_month'
    | 'custom'

const OPERATIONS_START_DATE = '2026-04-28'
const OPERATIONS_TIME_ZONE = 'America/Chicago'

function padNumber(value: number) {
    return String(value).padStart(2, '0')
}

function parseDateInput(dateInput: string) {
    const [year, month, day] = dateInput.split('-').map(Number)
    return { year, month, day }
}

function formatDateInputFromParts(year: number, month: number, day: number) {
    return `${year}-${padNumber(month)}-${padNumber(day)}`
}

function getTodayInputInTimeZone() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: OPERATIONS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())

    const month = parts.find(part => part.type === 'month')?.value || '01'
    const day = parts.find(part => part.type === 'day')?.value || '01'
    const year = parts.find(part => part.type === 'year')?.value || '2026'

    return `${year}-${month}-${day}`
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

function clampDateInputToOperationsStart(dateInput: string) {
    return dateInput < OPERATIONS_START_DATE
        ? OPERATIONS_START_DATE
        : dateInput
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date)

    const values = Object.fromEntries(
        parts
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    )

    const asUTC = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
    )

    return asUTC - date.getTime()
}

function zonedDateTimeToUtc({
    dateInput,
    hour,
    minute,
    second,
    millisecond,
}: {
    dateInput: string
    hour: number
    minute: number
    second: number
    millisecond: number
}) {
    const { year, month, day } = parseDateInput(dateInput)

    const utcGuess = new Date(
        Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
    )

    const firstOffset = getTimeZoneOffsetMs(utcGuess, OPERATIONS_TIME_ZONE)
    const firstPass = new Date(utcGuess.getTime() - firstOffset)
    const secondOffset = getTimeZoneOffsetMs(firstPass, OPERATIONS_TIME_ZONE)

    return new Date(utcGuess.getTime() - secondOffset)
}

function getStartOfChicagoDay(dateInput: string) {
    return zonedDateTimeToUtc({
        dateInput,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
    })
}

function getEndOfChicagoDay(dateInput: string) {
    return zonedDateTimeToUtc({
        dateInput,
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
    })
}

function getDateRange({
    preset,
    customStartDate,
    customEndDate,
}: {
    preset: DateRangePreset
    customStartDate: string
    customEndDate: string
}) {
    const todayInput = getTodayInputInTimeZone()

    let startDateInput = OPERATIONS_START_DATE
    let endDateInput = todayInput
    let label = 'All Time'

    if (preset === 'today') {
        startDateInput = clampDateInputToOperationsStart(todayInput)
        endDateInput = todayInput
        label = 'Today'
    }

    if (preset === 'last_7_days') {
        startDateInput = clampDateInputToOperationsStart(
            addDaysToDateInput(todayInput, -6)
        )
        endDateInput = todayInput
        label = 'Last 7 Days'
    }

    if (preset === 'this_month') {
        startDateInput = clampDateInputToOperationsStart(
            getFirstDayOfMonth(todayInput)
        )
        endDateInput = todayInput
        label = 'This Month'
    }

    if (preset === 'last_month') {
        startDateInput = clampDateInputToOperationsStart(
            getFirstDayOfPreviousMonth(todayInput)
        )
        endDateInput = getLastDayOfPreviousMonth(todayInput)
        label = 'Last Month'

        if (endDateInput < OPERATIONS_START_DATE) {
            endDateInput = OPERATIONS_START_DATE
        }
    }

    if (preset === 'custom') {
        startDateInput = clampDateInputToOperationsStart(customStartDate)
        endDateInput = customEndDate

        if (endDateInput < startDateInput) {
            endDateInput = startDateInput
        }

        label = 'Custom Range'
    }

    return {
        startDate: getStartOfChicagoDay(startDateInput),
        endDate: getEndOfChicagoDay(endDateInput),
        startDateInput,
        endDateInput,
        label,
    }
}

function formatDateFromInput(dateInput: string) {
    const { year, month, day } = parseDateInput(dateInput)

    return new Intl.DateTimeFormat('en-US', {
        timeZone: OPERATIONS_TIME_ZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)))
}

function formatDateRangeLabel({
    label,
    startDateInput,
    endDateInput,
}: {
    label: string
    startDateInput: string
    endDateInput: string
}) {
    const startLabel = formatDateFromInput(startDateInput)
    const endLabel = formatDateFromInput(endDateInput)

    if (startDateInput === endDateInput) {
        return `${label}: ${startLabel}`
    }

    return `${label}: ${startLabel} – ${endLabel}`
}

export default function OperationsPage() {
    const todayInput = getTodayInputInTimeZone()

    const [summary, setSummary] = useState<OperationsSummary | null>(null)
    const [workflows, setWorkflows] = useState<WorkflowMetric[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reportCopied, setReportCopied] = useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<SortOption>('time_saved_desc')
    const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all')
    const [visibleLimit, setVisibleLimit] = useState(15)

    const [dateRangePreset, setDateRangePreset] =
        useState<DateRangePreset>('all_time')

    const [customStartDate, setCustomStartDate] =
        useState(OPERATIONS_START_DATE)

    const [customEndDate, setCustomEndDate] = useState(todayInput)

    const selectedDateRange = useMemo(() => {
        return getDateRange({
            preset: dateRangePreset,
            customStartDate,
            customEndDate,
        })
    }, [dateRangePreset, customStartDate, customEndDate])

    const displayedStartDate =
        dateRangePreset === 'custom'
            ? customStartDate
            : selectedDateRange.startDateInput

    const displayedEndDate =
        dateRangePreset === 'custom'
            ? customEndDate
            : selectedDateRange.endDateInput

    const selectedDateRangeLabel = formatDateRangeLabel({
        label: selectedDateRange.label,
        startDateInput: selectedDateRange.startDateInput,
        endDateInput: selectedDateRange.endDateInput,
    })

    function applyCardFilter({
        filter,
        sort,
        search = '',
    }: {
        filter: ImpactFilter
        sort?: SortOption
        search?: string
    }) {
        setImpactFilter(filter)
        setSearchQuery(search)
        setVisibleLimit(15)

        if (sort) {
            setSortBy(sort)
        }
    }

    const loadOperationsData = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const params = new URLSearchParams({
                startDate: selectedDateRange.startDate.toISOString(),
                endDate: selectedDateRange.endDate.toISOString(),
            })

            const [summaryResponse, workflowsResponse] = await Promise.all([
                fetch(`/api/operations/summary?${params.toString()}`),
                fetch(`/api/operations/workflows?${params.toString()}`),
            ])

            if (!summaryResponse.ok) {
                throw new Error('Failed to load operations summary')
            }

            if (!workflowsResponse.ok) {
                throw new Error('Failed to load workflow metrics')
            }

            const summaryData = await summaryResponse.json()
            const workflowsData = await workflowsResponse.json()

            setSummary(summaryData)
            setWorkflows(workflowsData.workflows || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }, [selectedDateRange])

    useEffect(() => {
        loadOperationsData()
    }, [loadOperationsData])

    const topWorkflow = useMemo(() => {
        if (workflows.length === 0) return null

        return [...workflows].sort(
            (a, b) =>
                b.total_time_saved_minutes - a.total_time_saved_minutes ||
                b.successful_executions - a.successful_executions
        )[0]
    }, [workflows])

    const needsAttentionCount = useMemo(() => {
        return workflows.filter(
            workflow =>
                workflow.failed_or_other_executions > 0 ||
                workflow.success_rate < 90
        ).length
    }, [workflows])

    const maxTimeSaved = useMemo(() => {
        return Math.max(
            ...workflows.map(workflow => workflow.total_time_saved_minutes),
            0
        )
    }, [workflows])

    const filteredWorkflows = useMemo(() => {
        const query = searchQuery.toLowerCase().trim()

        return workflows
            .filter(workflow => {
                const matchesSearch =
                    !query ||
                    workflow.workflow_name.toLowerCase().includes(query) ||
                    workflow.workflow_id?.toLowerCase().includes(query)

                if (!matchesSearch) return false

                if (impactFilter === 'successful_workflows') {
                    return workflow.successful_executions > 0
                }

                if (impactFilter === 'with_time_saved') {
                    return workflow.total_time_saved_minutes > 0
                }

                if (impactFilter === 'no_time_saved') {
                    return workflow.total_time_saved_minutes === 0
                }

                if (impactFilter === 'has_failures') {
                    return workflow.failed_or_other_executions > 0
                }

                if (impactFilter === 'low_success_rate') {
                    return workflow.success_rate < 90
                }

                if (impactFilter === 'needs_attention') {
                    return (
                        workflow.failed_or_other_executions > 0 ||
                        workflow.success_rate < 90
                    )
                }

                return true
            })
            .sort((a, b) => {
                if (sortBy === 'time_saved_desc') {
                    return b.total_time_saved_minutes - a.total_time_saved_minutes
                }

                if (sortBy === 'time_saved_asc') {
                    return a.total_time_saved_minutes - b.total_time_saved_minutes
                }

                if (sortBy === 'executions_desc') {
                    return b.total_executions - a.total_executions
                }

                if (sortBy === 'success_rate_desc') {
                    return b.success_rate - a.success_rate
                }

                if (sortBy === 'success_rate_asc') {
                    return a.success_rate - b.success_rate
                }

                if (sortBy === 'latest_run_desc') {
                    return (
                        new Date(b.last_started_at || 0).getTime() -
                        new Date(a.last_started_at || 0).getTime()
                    )
                }

                if (sortBy === 'workflow_name_asc') {
                    return a.workflow_name.localeCompare(b.workflow_name)
                }

                if (sortBy === 'failures_desc') {
                    return (
                        b.failed_or_other_executions -
                        a.failed_or_other_executions
                    )
                }

                return 0
            })
    }, [workflows, searchQuery, sortBy, impactFilter])

    const visibleWorkflows = filteredWorkflows.slice(0, visibleLimit)

    function buildClickUpReport() {
        if (!summary) {
            return ''
        }

        const topTimeSavedWorkflows = [...workflows]
            .filter(workflow => workflow.total_time_saved_minutes > 0)
            .sort(
                (a, b) =>
                    b.total_time_saved_minutes - a.total_time_saved_minutes ||
                    b.successful_executions - a.successful_executions
            )
            .slice(0, 5)

        const topExecutionWorkflows = [...workflows]
            .sort(
                (a, b) =>
                    b.total_executions - a.total_executions ||
                    b.successful_executions - a.successful_executions
            )
            .slice(0, 5)

        const topWorkflowText = topWorkflow
            ? `- ${topWorkflow.workflow_name}
- Time saved: ${formatTimeSaved(topWorkflow.total_time_saved_minutes)}
- Successful runs: ${topWorkflow.successful_executions.toLocaleString()}
- Last run: ${formatDate(topWorkflow.last_started_at)}`
            : '- No top workflow available'

        const topTimeSavedWorkflowText =
            topTimeSavedWorkflows.length > 0
                ? topTimeSavedWorkflows
                    .map(
                        (workflow, index) =>
                            `${index + 1}. ${workflow.workflow_name
                            } — ${formatTimeSaved(
                                workflow.total_time_saved_minutes
                            )}, ${workflow.successful_executions.toLocaleString()} successful runs, ${workflow.success_rate.toFixed(
                                1
                            )}% success rate`
                    )
                    .join('\n')
                : 'No workflows with recorded time saved for this period.'

        const topExecutionWorkflowText =
            topExecutionWorkflows.length > 0
                ? topExecutionWorkflows
                    .map(
                        (workflow, index) =>
                            `${index + 1}. ${workflow.workflow_name
                            } — ${workflow.total_executions.toLocaleString()} executions, ${workflow.successful_executions.toLocaleString()} successful, ${workflow.success_rate.toFixed(
                                1
                            )}% success rate`
                    )
                    .join('\n')
                : 'No workflow execution data available.'

        return `**Operations Dashboard Update**
Date Range: ${selectedDateRangeLabel} (${OPERATIONS_TIME_ZONE})

**Summary**
- Total executions: ${summary.totalExecutions.toLocaleString()}
- Successful executions: ${summary.successfulExecutions.toLocaleString()}
- Failed executions: ${summary.failedExecutions.toLocaleString()}
- Waiting executions: ${summary.waitingExecutions.toLocaleString()}
- Success rate: ${summary.successRate.toFixed(1)}%
- Estimated time saved: ${summary.totalTimeSavedMinutes.toFixed(
            0
        )} minutes / ${summary.totalHoursSaved.toFixed(1)} hours
- Estimated workdays saved: ${summary.totalWorkdaysSaved.toFixed(1)}

**Top Impact Workflow**
${topWorkflowText}

**Top Workflows by Estimated Time Saved**
${topTimeSavedWorkflowText}

**Top Workflows by Execution Volume**
${topExecutionWorkflowText}

**Workflow Notes**
- ${workflows.length.toLocaleString()} workflows were included in this report.
- ${needsAttentionCount.toLocaleString()} workflows may need review based on failures or low success rate.
- Time saved is based on execution-level \`time_saved_minutes\` values currently recorded in Supabase.
- Report generated from the Operations Dashboard.`
    }

    async function copyClickUpReport() {
        const report = buildClickUpReport()

        if (!report) {
            return
        }

        try {
            await navigator.clipboard.writeText(report)
            setReportCopied(true)

            window.setTimeout(() => {
                setReportCopied(false)
            }, 2500)
        } catch (err) {
            console.error('Failed to copy ClickUp report:', err)
            alert('Failed to copy report. Please try again.')
        }
    }

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 border border-orange-100 dark:border-orange-900 text-orange-700 dark:text-orange-300 text-xs font-medium mb-3">
                        📊 Automation ROI
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight">
                        Operations Dashboard
                    </h1>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">
                        Track automation performance, execution health, and the
                        estimated operational time saved by your n8n workflows.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                        onClick={copyClickUpReport}
                        disabled={!summary}
                        className="px-4 py-2 rounded-xl border border-[#F07D19]/40 text-[#F07D19] text-sm font-medium hover:bg-[#F07D19]/10 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {reportCopied ? 'Report Copied!' : 'Copy ClickUp Report'}
                    </button>

                    <button
                        onClick={loadOperationsData}
                        className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-800 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-6 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold">Date Range</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Data is available starting April 28, 2026. Ranges are
                            calculated using Chicago time.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full xl:w-auto">
                        <select
                            value={dateRangePreset}
                            onChange={event => {
                                setDateRangePreset(
                                    event.target.value as DateRangePreset
                                )
                                setVisibleLimit(15)
                            }}
                            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm outline-none focus:ring-2 focus:ring-[#F07D19]"
                        >
                            <option value="all_time">All Time</option>
                            <option value="today">Today</option>
                            <option value="last_7_days">Last 7 Days</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="custom">Custom Range</option>
                        </select>

                        <input
                            type="date"
                            value={displayedStartDate}
                            min={OPERATIONS_START_DATE}
                            max={todayInput}
                            disabled={dateRangePreset !== 'custom'}
                            onChange={event => {
                                setCustomStartDate(event.target.value)
                                setVisibleLimit(15)
                            }}
                            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] disabled:opacity-50"
                        />

                        <input
                            type="date"
                            value={displayedEndDate}
                            min={OPERATIONS_START_DATE}
                            max={todayInput}
                            disabled={dateRangePreset !== 'custom'}
                            onChange={event => {
                                setCustomEndDate(event.target.value)
                                setVisibleLimit(15)
                            }}
                            className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm outline-none focus:ring-2 focus:ring-[#F07D19] disabled:opacity-50"
                        />

                        <div className="px-3 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-sm border border-orange-100 dark:border-orange-900">
                            {selectedDateRangeLabel}
                        </div>
                    </div>
                </div>
            </section>

            {loading && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
                    Loading operations data...
                </div>
            )}

            {error && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-2xl p-6">
                    {error}
                </div>
            )}

            {!loading && !error && summary && (
                <>
                    <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
                        <button
                            type="button"
                            onClick={() =>
                                applyCardFilter({
                                    filter: 'with_time_saved',
                                    sort: 'time_saved_desc',
                                })
                            }
                            className={`xl:col-span-2 text-left rounded-2xl bg-gradient-to-br from-[#F6A04D] via-[#F07D19] to-[#C85E0B] text-white p-6 shadow-sm overflow-hidden relative transition-transform hover:-translate-y-0.5 hover:shadow-lg ${impactFilter === 'with_time_saved'
                                ? 'ring-2 ring-[#F07D19]'
                                : ''
                                }`}
                        >
                            <div className="absolute right-6 top-6 h-20 w-20 rounded-3xl bg-white/20 border border-white/20 flex items-center justify-center text-5xl shadow-sm">
                                ⏱️
                            </div>

                            <p className="text-sm text-orange-50 font-medium">
                                Total Estimated Time Saved
                            </p>

                            <div className="mt-4 flex flex-col md:flex-row md:items-end gap-3">
                                <h2 className="text-5xl font-bold tracking-tight">
                                    {summary.totalHoursSaved.toFixed(1)} hrs
                                </h2>

                                <p className="text-orange-50 mb-1">
                                    or {summary.totalTimeSavedMinutes.toFixed(0)} minutes
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">
                                <HeroMiniStat
                                    label="Workdays Saved"
                                    value={summary.totalWorkdaysSaved.toFixed(1)}
                                    helper="8-hour workday"
                                />

                                <HeroMiniStat
                                    label="Avg. Saved"
                                    value={`${summary.avgTimeSavedPerSuccessfulExecution.toFixed(
                                        1
                                    )} min`}
                                    helper="per successful run"
                                />

                                <HeroMiniStat
                                    label="Success Rate"
                                    value={`${summary.successRate.toFixed(1)}%`}
                                    helper="all executions"
                                />
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (!topWorkflow) return

                                applyCardFilter({
                                    filter: 'all',
                                    sort: 'time_saved_desc',
                                    search:
                                        topWorkflow.workflow_id ||
                                        topWorkflow.workflow_name,
                                })
                            }}
                            className="text-left rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Top Impact Workflow
                                    </p>
                                    <h3 className="text-lg font-semibold mt-2">
                                        {topWorkflow?.workflow_name || 'No workflow yet'}
                                    </h3>
                                </div>

                                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xl shrink-0">
                                    🏆
                                </div>
                            </div>

                            <div className="mt-6 space-y-4">
                                <InfoRow
                                    label="Time Saved"
                                    value={
                                        topWorkflow
                                            ? formatTimeSaved(
                                                topWorkflow.total_time_saved_minutes
                                            )
                                            : '—'
                                    }
                                />

                                <InfoRow
                                    label="Successful Runs"
                                    value={
                                        topWorkflow
                                            ? topWorkflow.successful_executions.toLocaleString()
                                            : '—'
                                    }
                                />

                                <InfoRow
                                    label="Last Run"
                                    value={
                                        topWorkflow
                                            ? formatDate(topWorkflow.last_started_at)
                                            : '—'
                                    }
                                />
                            </div>
                        </button>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                        <MetricCard
                            icon="⚡"
                            label="Total Executions"
                            value={summary.totalExecutions.toLocaleString()}
                            helper="Click to show all workflows"
                            isActive={impactFilter === 'all' && !searchQuery}
                            onClick={() =>
                                applyCardFilter({
                                    filter: 'all',
                                    sort: 'executions_desc',
                                })
                            }
                        />

                        <MetricCard
                            icon="✅"
                            label="Successful Executions"
                            value={summary.successfulExecutions.toLocaleString()}
                            helper="Click to show workflows with successful runs"
                            tone="success"
                            isActive={impactFilter === 'successful_workflows'}
                            onClick={() =>
                                applyCardFilter({
                                    filter: 'successful_workflows',
                                    sort: 'success_rate_desc',
                                })
                            }
                        />

                        <MetricCard
                            icon="🚨"
                            label="Failed Executions"
                            value={summary.failedExecutions.toLocaleString()}
                            helper="Click to show workflows with failures"
                            tone={summary.failedExecutions > 0 ? 'danger' : 'neutral'}
                            isActive={impactFilter === 'has_failures'}
                            onClick={() =>
                                applyCardFilter({
                                    filter: 'has_failures',
                                    sort: 'failures_desc',
                                })
                            }
                        />

                        <MetricCard
                            icon="🧭"
                            label="Workflows to Review"
                            value={needsAttentionCount.toLocaleString()}
                            helper="Click to show workflows needing attention"
                            tone={needsAttentionCount > 0 ? 'warning' : 'success'}
                            isActive={impactFilter === 'needs_attention'}
                            onClick={() =>
                                applyCardFilter({
                                    filter: 'needs_attention',
                                    sort: 'success_rate_asc',
                                })
                            }
                        />
                    </section>

                    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
                            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold">
                                        Workflow Impact Breakdown
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Compare workflow performance, execution volume,
                                        failure count, and estimated time saved.
                                    </p>
                                </div>

                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Showing {visibleWorkflows.length.toLocaleString()} of{' '}
                                    {filteredWorkflows.length.toLocaleString()} workflows
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                                <input
                                    value={searchQuery}
                                    onChange={event => {
                                        setSearchQuery(event.target.value)
                                        setVisibleLimit(15)
                                    }}
                                    placeholder="Search workflow..."
                                    className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm outline-none focus:ring-2 focus:ring-[#F07D19]"
                                />

                                <select
                                    value={impactFilter}
                                    onChange={event => {
                                        setImpactFilter(event.target.value as ImpactFilter)
                                        setVisibleLimit(15)
                                    }}
                                    className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm outline-none focus:ring-2 focus:ring-[#F07D19]"
                                >
                                    <option value="all">All workflows</option>
                                    <option value="successful_workflows">
                                        With successful executions
                                    </option>
                                    <option value="with_time_saved">
                                        With time saved
                                    </option>
                                    <option value="no_time_saved">
                                        No time saved
                                    </option>
                                    <option value="has_failures">
                                        Has failures
                                    </option>
                                    <option value="low_success_rate">
                                        Success rate below 90%
                                    </option>
                                    <option value="needs_attention">
                                        Needs attention
                                    </option>
                                </select>

                                <select
                                    value={sortBy}
                                    onChange={event =>
                                        setSortBy(event.target.value as SortOption)
                                    }
                                    className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm outline-none focus:ring-2 focus:ring-[#F07D19]"
                                >
                                    <option value="time_saved_desc">
                                        Sort: Time saved, highest first
                                    </option>
                                    <option value="time_saved_asc">
                                        Sort: Time saved, lowest first
                                    </option>
                                    <option value="executions_desc">
                                        Sort: Most executions
                                    </option>
                                    <option value="success_rate_desc">
                                        Sort: Success rate, highest first
                                    </option>
                                    <option value="success_rate_asc">
                                        Sort: Success rate, lowest first
                                    </option>
                                    <option value="failures_desc">
                                        Sort: Most failures
                                    </option>
                                    <option value="latest_run_desc">
                                        Sort: Latest run
                                    </option>
                                    <option value="workflow_name_asc">
                                        Sort: Workflow name A-Z
                                    </option>
                                </select>

                                <button
                                    onClick={() => {
                                        setSearchQuery('')
                                        setImpactFilter('all')
                                        setSortBy('time_saved_desc')
                                        setVisibleLimit(15)
                                    }}
                                    className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Reset filters
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="text-left font-medium px-5 py-3">
                                            Workflow
                                        </th>
                                        <th className="text-right font-medium px-5 py-3">
                                            Executions
                                        </th>
                                        <th className="text-right font-medium px-5 py-3">
                                            Health
                                        </th>
                                        <th className="text-right font-medium px-5 py-3">
                                            Time Saved
                                        </th>
                                        <th className="text-left font-medium px-5 py-3 min-w-[180px]">
                                            Impact
                                        </th>
                                        <th className="text-right font-medium px-5 py-3">
                                            Avg Saved
                                        </th>
                                        <th className="text-right font-medium px-5 py-3">
                                            Last Run
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {visibleWorkflows.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-5 py-8 text-center text-gray-500 dark:text-gray-400"
                                            >
                                                No workflow metrics found for this date range.
                                            </td>
                                        </tr>
                                    )}

                                    {visibleWorkflows.map(workflow => {
                                        const progress =
                                            maxTimeSaved > 0
                                                ? Math.min(
                                                    100,
                                                    (workflow.total_time_saved_minutes /
                                                        maxTimeSaved) *
                                                    100
                                                )
                                                : 0

                                        return (
                                            <tr
                                                key={
                                                    workflow.workflow_id ||
                                                    workflow.workflow_name
                                                }
                                                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                        {workflow.workflow_name}
                                                    </div>
                                                    {workflow.workflow_id && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                            {workflow.workflow_id}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <div className="font-semibold">
                                                        {workflow.total_executions.toLocaleString()}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {workflow.successful_executions.toLocaleString()}{' '}
                                                        successful
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <StatusBadge
                                                        successRate={workflow.success_rate}
                                                        failures={
                                                            workflow.failed_or_other_executions
                                                        }
                                                    />
                                                    {workflow.failed_or_other_executions >
                                                        0 && (
                                                            <div className="text-xs text-red-500 mt-1">
                                                                {
                                                                    workflow.failed_or_other_executions
                                                                }{' '}
                                                                failed/other
                                                            </div>
                                                        )}
                                                </td>

                                                <td className="px-5 py-4 text-right font-semibold">
                                                    {formatTimeSaved(
                                                        workflow.total_time_saved_minutes
                                                    )}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-[#F07D19]"
                                                            style={{
                                                                width: `${progress}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {progress.toFixed(0)}% of top
                                                        workflow impact
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    {workflow.avg_time_saved_minutes.toFixed(
                                                        1
                                                    )}{' '}
                                                    min
                                                </td>

                                                <td className="px-5 py-4 text-right text-gray-500 dark:text-gray-400">
                                                    {formatDate(workflow.last_started_at)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {filteredWorkflows.length > visibleLimit && (
                            <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex justify-center">
                                <button
                                    onClick={() => setVisibleLimit(prev => prev + 15)}
                                    className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-800 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Show more workflows
                                </button>
                            </div>
                        )}
                    </section>
                </>
            )}
        </main>
    )
}

function MetricCard({
    icon,
    label,
    value,
    helper,
    tone = 'neutral',
    onClick,
    isActive = false,
}: {
    icon: string
    label: string
    value: string
    helper?: string
    tone?: 'neutral' | 'success' | 'warning' | 'danger'
    onClick?: () => void
    isActive?: boolean
}) {
    const toneClasses = {
        neutral:
            'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
        success:
            'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300',
        warning:
            'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
        danger:
            'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300',
    }

    const content = (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {label}
                </p>
                <p className="text-2xl font-bold mt-2">{value}</p>
                {helper && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {helper}
                    </p>
                )}
            </div>

            <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneClasses[tone]}`}
            >
                {icon}
            </div>
        </div>
    )

    const className = `w-full text-left bg-white dark:bg-gray-900 border rounded-2xl p-5 shadow-sm transition-all ${onClick ? 'hover:-translate-y-0.5 hover:shadow-lg cursor-pointer' : ''
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

function HeroMiniStat({
    label,
    value,
    helper,
}: {
    label: string
    value: string
    helper: string
}) {
    return (
        <div className="rounded-xl bg-white/10 border border-white/10 p-4">
            <p className="text-xs text-orange-50">{label}</p>
            <p className="text-xl font-semibold mt-1">{value}</p>
            <p className="text-xs text-orange-50 mt-1">{helper}</p>
        </div>
    )
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{label}</span>
            <span className="font-semibold text-right">{value}</span>
        </div>
    )
}

function StatusBadge({
    successRate,
    failures,
}: {
    successRate: number
    failures: number
}) {
    if (failures > 0 || successRate < 90) {
        return (
            <span className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900">
                Review
            </span>
        )
    }

    return (
        <span className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900">
            Healthy
        </span>
    )
}

function formatTimeSaved(minutes: number) {
    if (!minutes || minutes <= 0) {
        return '0 min'
    }

    if (minutes < 60) {
        return `${minutes.toFixed(0)} min`
    }

    return `${(minutes / 60).toFixed(1)} hrs`
}

function formatDate(value: string | Date | null) {
    if (!value) {
        return '—'
    }

    const date = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(date.getTime())) {
        return '—'
    }

    return new Intl.DateTimeFormat('en-US', {
        timeZone: OPERATIONS_TIME_ZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date)
}