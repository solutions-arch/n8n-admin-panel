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
    duration_seconds: number | null
    time_saved_minutes: number | null
    time_saved_source: string | null
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
        duration_seconds,
        time_saved_minutes,
        time_saved_source
        `
            )
            .order('started_at', { ascending: false })
            .range(from, to)

        if (error) {
            throw error
        }

        const rows = data || []
        allRows = [...allRows, ...rows]

        if (rows.length < pageSize) {
            break
        }

        from += pageSize
        to += pageSize
    }

    return allRows
}

export async function GET() {
    try {
        const rows = await fetchAllExecutions()

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

        const totalTimeSavedMinutes = successfulExecutions.reduce(
            (sum, row) => sum + Number(row.time_saved_minutes || 0),
            0
        )

        const totalDurationSeconds = rows.reduce(
            (sum, row) => sum + Number(row.duration_seconds || 0),
            0
        )

        const avgTimeSavedPerSuccessfulExecution =
            successfulCount > 0 ? totalTimeSavedMinutes / successfulCount : 0

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
            totalDurationSeconds,
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