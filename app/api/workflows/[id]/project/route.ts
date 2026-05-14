import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params
        const body = await request.json()

        const automationProjectId =
            body.automation_project_id === ''
                ? null
                : body.automation_project_id ?? null

        const workflowName =
            typeof body.workflow_name === 'string' && body.workflow_name.trim()
                ? body.workflow_name.trim()
                : id

        if (automationProjectId) {
            const { data: project, error: projectError } = await supabaseAdmin
                .from('automation_projects')
                .select('automation_project_id, project_name')
                .eq('automation_project_id', automationProjectId)
                .maybeSingle()

            if (projectError || !project) {
                return NextResponse.json(
                    { error: 'Automation project not found' },
                    { status: 404 }
                )
            }
        }

        const { data: existingWorkflow, error: existingWorkflowError } =
            await supabaseAdmin
                .from('workflows')
                .select('workflow_id')
                .eq('workflow_id', id)
                .maybeSingle()

        if (existingWorkflowError) {
            return NextResponse.json(
                {
                    error: 'Failed to check workflow record',
                    detail: existingWorkflowError.message,
                },
                { status: 500 }
            )
        }

        if (!existingWorkflow) {
            const { error: insertError } = await supabaseAdmin
                .from('workflows')
                .insert({
                    workflow_id: id,
                    workflow_name: workflowName,
                    automation_project_id: automationProjectId,
                    synced_at: new Date().toISOString(),
                })

            if (insertError) {
                return NextResponse.json(
                    {
                        error: 'Failed to create workflow registry record',
                        detail: insertError.message,
                    },
                    { status: 500 }
                )
            }
        } else {
            const { error: updateError } = await supabaseAdmin
                .from('workflows')
                .update({
                    automation_project_id: automationProjectId,
                })
                .eq('workflow_id', id)

            if (updateError) {
                return NextResponse.json(
                    {
                        error: 'Failed to update workflow project',
                        detail: updateError.message,
                    },
                    { status: 500 }
                )
            }
        }

        const { data, error } = await supabaseAdmin
            .from('workflow_registry')
            .select(
                `
                workflow_id,
                workflow_name,
                automation_project_id,
                automation_project_name,
                automation_project_slug,
                n8n_folder_id,
                n8n_folder_url
                `
            )
            .eq('workflow_id', id)
            .maybeSingle()

        if (error) {
            return NextResponse.json(
                {
                    error: 'Workflow project was saved, but failed to reload registry data',
                    detail: error.message,
                },
                { status: 500 }
            )
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Workflow project update error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}