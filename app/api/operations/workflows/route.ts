// app/api/operations/workflows/route.ts

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type WorkflowExecutionRow = {
    execution_id: string
    workflow_id: string | null
    workflow_name: string | null
    status: string | null
    mode: string | null
    started_at: string | null
    stopped_at: string | null
    wait_till: string | null
    duration_seconds: number | null
    retry_of: string | null
    retry_success_id: string | null
    error_message: string | null
    synced_at: string | null
    time_saved_minutes: number | string | null
    time_saved_source: string | null
    time_saved_reason: string | null
}

function normalizeStatus(status: string | null) {
    return status?.toLowerCase().trim() || 'unknown'
}

function isSuccessful(status: string | null) {
    const normalized = normalizeStatus(status)
    return normalized === 'success' || normalized === 'succeeded'
}

function getEffectiveDate(row: WorkflowExecutionRow) {
    const value = row.started_at || row.stopped_at || row.synced_at

    if (!value) {
        return null
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return null
    }

    return date
}

function filterRowsByDate({
    rows,
    startDate,
    endDate,
}: {
    rows: WorkflowExecutionRow[]
    startDate?: string | null
    endDate?: string | null
}) {
    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null

    const hasValidStart = start && !Number.isNaN(start.getTime())
    const hasValidEnd = end && !Number.isNaN(end.getTime())

    if (!hasValidStart && !hasValidEnd) {
        return rows
    }

    return rows.filter(row => {
        const effectiveDate = getEffectiveDate(row)

        if (!effectiveDate) {
            return false
        }

        if (hasValidStart && effectiveDate < start) {
            return false
        }

        if (hasValidEnd && effectiveDate > end) {
            return false
        }

        return true
    })
}

async function fetchAllExecutions() {
    const pageSize = 1000
    let from = 0
    let to = pageSize - 1
    let allRows: WorkflowExecutionRow[] = []

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('workflow_executions')
            .select(
                `
                execution_id,
                workflow_id,
                workflow_name,
                status,
                mode,
                started_at,
                stopped_at,
                wait_till,
                duration_seconds,
                retry_of,
                retry_success_id,
                error_message,
                synced_at,
                time_saved_minutes,
                time_saved_source,
                time_saved_reason
                `
            )
            .order('started_at', { ascending: false, nullsFirst: false })
            .range(from, to)

        if (error) {
            throw error
        }

        const rows = (data || []) as WorkflowExecutionRow[]
        allRows = [...allRows, ...rows]

        if (rows.length < pageSize) {
            break
        }

        from += pageSize
        to += pageSize
    }

    return allRows
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)

        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        const allRows = await fetchAllExecutions()

        const rows = filterRowsByDate({
            rows: allRows,
            startDate,
            endDate,
        })

        const grouped = new Map<
            string,
            {
                workflow_id: string | null
                workflow_name: string
                total_executions: number
                successful_executions: number
                failed_or_other_executions: number
                time_saving_executions: number
                total_time_saved_minutes: number
                total_duration_seconds: number
                avg_time_saved_minutes: number
                last_started_at: string | null
            }
        >()

        for (const row of rows) {
            const key = row.workflow_id || row.workflow_name || 'unknown-workflow'

            if (!grouped.has(key)) {
                grouped.set(key, {
                    workflow_id: row.workflow_id,
                    workflow_name: row.workflow_name || 'Unknown workflow',
                    total_executions: 0,
                    successful_executions: 0,
                    failed_or_other_executions: 0,
                    time_saving_executions: 0,
                    total_time_saved_minutes: 0,
                    total_duration_seconds: 0,
                    avg_time_saved_minutes: 0,
                    last_started_at: row.started_at || row.stopped_at || row.synced_at,
                })
            }

            const item = grouped.get(key)!

            const timeSaved = Number(row.time_saved_minutes || 0)

            item.total_executions += 1
            item.total_duration_seconds += Number(row.duration_seconds || 0)
            item.total_time_saved_minutes += timeSaved

            if (timeSaved > 0) {
                item.time_saving_executions += 1
            }

            if (isSuccessful(row.status)) {
                item.successful_executions += 1
            } else {
                item.failed_or_other_executions += 1
            }

            const effectiveDateString =
                row.started_at || row.stopped_at || row.synced_at

            if (
                effectiveDateString &&
                (!item.last_started_at ||
                    new Date(effectiveDateString) > new Date(item.last_started_at))
            ) {
                item.last_started_at = effectiveDateString
            }
        }

        const workflows = Array.from(grouped.values())
            .map(item => ({
                ...item,
                avg_time_saved_minutes:
                    item.successful_executions > 0
                        ? item.total_time_saved_minutes / item.successful_executions
                        : 0,
                avg_time_saved_per_time_saving_execution:
                    item.time_saving_executions > 0
                        ? item.total_time_saved_minutes / item.time_saving_executions
                        : 0,
                total_time_saved_hours: item.total_time_saved_minutes / 60,
                success_rate:
                    item.total_executions > 0
                        ? (item.successful_executions / item.total_executions) * 100
                        : 0,
            }))
            .sort(
                (a, b) =>
                    b.total_time_saved_minutes - a.total_time_saved_minutes ||
                    b.successful_executions - a.successful_executions
            )

        return NextResponse.json({
            workflows,
            dateRange: {
                startDate,
                endDate,
            },
            diagnostics: {
                totalRowsBeforeDateFilter: allRows.length,
                totalRowsAfterDateFilter: rows.length,
                timeSavedBeforeDateFilter: allRows.reduce(
                    (sum, row) => sum + Number(row.time_saved_minutes || 0),
                    0
                ),
                timeSavedAfterDateFilter: rows.reduce(
                    (sum, row) => sum + Number(row.time_saved_minutes || 0),
                    0
                ),
                rowsWithMissingStartedAt: allRows.filter(row => !row.started_at)
                    .length,
            },
        })
    } catch (error) {
        console.error('Operations workflows error:', error)

        return NextResponse.json(
            {
                error: 'Failed to load workflow operations summary',
            },
            { status: 500 }
        )
    }
}