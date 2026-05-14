// app/api/workflows/[id]/metadata/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const allowedAutomationTypes = ['Workflow', 'AI Agent']
const allowedLifecycleStages = ['Production', 'Development', 'Paused/Retired', 'Ad hoc']

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params
        const body = await request.json()

        const {
            automation_type,
            lifecycle_stage,
            business_owner,
            operational_notes,
        } = body

        if (!id) {
            return NextResponse.json(
                { error: 'Workflow ID is required' },
                { status: 400 }
            )
        }

        if (
            automation_type !== undefined &&
            automation_type !== null &&
            automation_type !== '' &&
            !allowedAutomationTypes.includes(automation_type)
        ) {
            return NextResponse.json(
                { error: 'Invalid automation_type' },
                { status: 400 }
            )
        }

        if (
            lifecycle_stage !== undefined &&
            lifecycle_stage !== null &&
            lifecycle_stage !== '' &&
            !allowedLifecycleStages.includes(lifecycle_stage)
        ) {
            return NextResponse.json(
                { error: 'Invalid lifecycle_stage' },
                { status: 400 }
            )
        }

        const updates: Record<string, string | null> = {}

        if (automation_type !== undefined) {
            updates.automation_type = automation_type || null
        }

        if (lifecycle_stage !== undefined) {
            updates.lifecycle_stage = lifecycle_stage || null
        }

        if (business_owner !== undefined) {
            updates.business_owner = business_owner || null
        }

        if (operational_notes !== undefined) {
            updates.operational_notes = operational_notes || null
        }

        const { data, error } = await supabaseAdmin
            .from('workflows')
            .update(updates)
            .eq('workflow_id', id)
            .select(
                `
                workflow_id,
                automation_type,
                lifecycle_stage,
                business_owner,
                operational_notes
                `
            )
            .single()

        if (error) {
            return NextResponse.json(
                {
                    error: 'Failed to update workflow metadata',
                    detail: error.message,
                },
                { status: 500 }
            )
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Workflow metadata update error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}