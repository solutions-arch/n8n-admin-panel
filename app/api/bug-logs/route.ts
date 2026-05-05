import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
    try {
        const { data: bugLogs, error: bugLogsError } = await supabaseAdmin
            .from('workflow_bug_logs')
            .select('*')
            .order('error_timestamp', {
                ascending: false,
                nullsFirst: false,
            })
            .order('created_at', {
                ascending: false,
            })

        if (bugLogsError) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch bug logs',
                    detail: bugLogsError.message,
                },
                { status: 500 }
            )
        }

        const workflowIds = Array.from(
            new Set(
                (bugLogs || [])
                    .map(log => log.workflow_id)
                    .filter(Boolean)
            )
        )

        let workflowsById: Record<string, any> = {}

        if (workflowIds.length > 0) {
            const { data: workflows, error: workflowsError } = await supabaseAdmin
                .from('workflows')
                .select('*')
                .in('workflow_id', workflowIds)

            if (workflowsError) {
                return NextResponse.json(
                    {
                        error: 'Failed to fetch related workflows',
                        detail: workflowsError.message,
                    },
                    { status: 500 }
                )
            }

            workflowsById = Object.fromEntries(
                (workflows || []).map(workflow => [
                    workflow.workflow_id,
                    workflow,
                ])
            )
        }

        const enrichedLogs = (bugLogs || []).map(log => {
            const workflow = log.workflow_id
                ? workflowsById[log.workflow_id]
                : null

            return {
                ...log,
                workflow_display_name:
                    workflow?.workflow_name || log.workflow_name || 'Unknown workflow',
                workflow_active: workflow?.active ?? null,
                workflow_archived: workflow?.archived ?? null,
                workflow_description: workflow?.description ?? null,
                workflow_tags: workflow?.tags ?? [],
                workflow_synced_at: workflow?.synced_at ?? null,
            }
        })

        return NextResponse.json(
            {
                data: enrichedLogs,
                count: enrichedLogs.length,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            }
        )
    } catch (error) {
        console.error('Bug logs fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}