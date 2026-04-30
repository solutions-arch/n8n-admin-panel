// app/api/operations/summary/route.ts

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

function isFailed(status: string | null) {
    const normalized = normalizeStatus(status)
    return normalized === 'error' || normalized === 'failed' || normalized === 'failure'
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

        const totalExecutions = rows.length

        const successfulExecutions = rows.filter(row =>
            isSuccessful(row.status)
        )

        const failedExecutions = rows.filter(row =>
            isFailed(row.status)
        )

        const waitingExecutions = rows.filter(row =>
            normalizeStatus(row.status) === 'waiting'
        )

        const successfulCount = successfulExecutions.length
        const failedCount = failedExecutions.length
        const waitingCount = waitingExecutions.length

        const otherCount =
            totalExecutions - successfulCount - failedCount - waitingCount

        const totalTimeSavedMinutes = rows.reduce(
            (sum, row) => sum + Number(row.time_saved_minutes || 0),
            0
        )

        const totalDurationSeconds = rows.reduce(
            (sum, row) => sum + Number(row.duration_seconds || 0),
            0
        )

        const timeSavingExecutions = rows.filter(
            row => Number(row.time_saved_minutes || 0) > 0
        )

        const avgTimeSavedPerSuccessfulExecution =
            successfulCount > 0 ? totalTimeSavedMinutes / successfulCount : 0

        const avgTimeSavedPerTimeSavingExecution =
            timeSavingExecutions.length > 0
                ? totalTimeSavedMinutes / timeSavingExecutions.length
                : 0

        const successRate =
            totalExecutions > 0 ? (successfulCount / totalExecutions) * 100 : 0

        const totalHoursSaved = totalTimeSavedMinutes / 60
        const totalWorkdaysSaved = totalHoursSaved / 8

        return NextResponse.json({
            totalExecutions,
            successfulExecutions: successfulCount,
            failedExecutions: failedCount,
            waitingExecutions: waitingCount,
            otherExecutions: otherCount,
            successRate,
            totalTimeSavedMinutes,
            totalHoursSaved,
            totalWorkdaysSaved,
            avgTimeSavedPerSuccessfulExecution,
            avgTimeSavedPerTimeSavingExecution,
            totalDurationSeconds,
            timeSavingExecutions: timeSavingExecutions.length,
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
                timeSavedAfterDateFilter: totalTimeSavedMinutes,
                rowsWithMissingStartedAt: allRows.filter(row => !row.started_at)
                    .length,
            },
        })
    } catch (error) {
        console.error('Operations summary error:', error)

        return NextResponse.json(
            {
                error: 'Failed to load operations summary',
            },
            { status: 500 }
        )
    }
}