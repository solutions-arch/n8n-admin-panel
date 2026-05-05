import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const VALID_STATUSES = [
    'reported',
    'triage',
    'in_progress',
    'code_review',
    'qa_testing',
    'rejected',
    'released',
    'done',
]

const RESOLVED_STATUSES = ['released', 'done']

type RouteContext = {
    params: Promise<{
        executionId: string
    }>
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { executionId } = await context.params
        const body = await request.json()

        const updates: Record<string, any> = {}

        if (body.status !== undefined) {
            if (!VALID_STATUSES.includes(body.status)) {
                return NextResponse.json(
                    {
                        error: 'Invalid status',
                        allowedStatuses: VALID_STATUSES,
                    },
                    { status: 400 }
                )
            }

            updates.status = body.status

            if (RESOLVED_STATUSES.includes(body.status)) {
                updates.resolved_at = new Date().toISOString()
                updates.resolved_by = body.resolved_by || 'interface'
            } else {
                updates.resolved_at = null
                updates.resolved_by = null
            }
        }

        if (body.resolution_notes !== undefined) {
            updates.resolution_notes = body.resolution_notes || null
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: 'No valid fields to update' },
                { status: 400 }
            )
        }

        const { data, error } = await supabaseAdmin
            .from('workflow_bug_logs')
            .update(updates)
            .eq('execution_id', executionId)
            .select()
            .single()

        if (error) {
            return NextResponse.json(
                {
                    error: 'Failed to update bug log',
                    detail: error.message,
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            data,
        })
    } catch (error) {
        console.error('Bug log update error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}