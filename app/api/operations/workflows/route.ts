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

async function fetchAllExecutions() {
    const pageSize = 1000
    let from = 0
    let to = pageSize - 1
    let allRows: WorkflowExecutionRow[] = []

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('workflow_executions')
            .select(`
                execution_id,
                workflow_id,
                workflow_name,
                status,
                mode,
                started_at,
                duration_seconds,
                time_saved_minutes,
                time_saved_source
            `)
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

        const grouped = new Map<
            string,
            {
                workflow_id: string | null
                workflow_name: string
                total_executions: number
                successful_executions: number
                failed_or_other_executions: number
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
                    total_time_saved_minutes: 0,
                    total_duration_seconds: 0,
                    avg_time_saved_minutes: 0,
                    last_started_at: row.started_at,
                })
            }

            const item = grouped.get(key)!

            item.total_executions += 1
            item.total_duration_seconds += Number(row.duration_seconds || 0)

            if (isSuccessful(row.status)) {
                item.successful_executions += 1
                item.total_time_saved_minutes += Number(row.time_saved_minutes || 0)
            } else {
                item.failed_or_other_executions += 1
            }

            if (
                row.started_at &&
                (!item.last_started_at ||
                    new Date(row.started_at) > new Date(item.last_started_at))
            ) {
                item.last_started_at = row.started_at
            }
        }

        const workflows = Array.from(grouped.values())
            .map(item => ({
                ...item,
                avg_time_saved_minutes:
                    item.successful_executions > 0
                        ? item.total_time_saved_minutes / item.successful_executions
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