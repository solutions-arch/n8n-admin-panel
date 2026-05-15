// app/api/workflows/[id]/metadata/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const allowedAutomationTypes = ['Workflow', 'AI Agent']
const allowedLifecycleStages = ['Production', 'Development', 'Paused/Retired', 'Ad hoc']

const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeOptionalText(value: unknown): string | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value !== 'string') return null

    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

function isUuid(value: string) {
    return uuidRegex.test(value)
}

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
            business_function_id,
            business_unit_id,
            supported_role_ids,
        } = body

        if (!id) {
            return NextResponse.json(
                { error: 'Workflow ID is required' },
                { status: 400 }
            )
        }

        const normalizedAutomationType = normalizeOptionalText(automation_type)
        const normalizedLifecycleStage = normalizeOptionalText(lifecycle_stage)
        const normalizedBusinessOwner = normalizeOptionalText(business_owner)
        const normalizedOperationalNotes = normalizeOptionalText(operational_notes)
        const normalizedBusinessFunctionId = normalizeOptionalText(business_function_id)
        const normalizedBusinessUnitId = normalizeOptionalText(business_unit_id)

        if (
            normalizedAutomationType !== undefined &&
            normalizedAutomationType !== null &&
            !allowedAutomationTypes.includes(normalizedAutomationType)
        ) {
            return NextResponse.json(
                { error: 'Invalid automation_type' },
                { status: 400 }
            )
        }

        if (
            normalizedLifecycleStage !== undefined &&
            normalizedLifecycleStage !== null &&
            !allowedLifecycleStages.includes(normalizedLifecycleStage)
        ) {
            return NextResponse.json(
                { error: 'Invalid lifecycle_stage' },
                { status: 400 }
            )
        }

        if (
            normalizedBusinessFunctionId !== undefined &&
            normalizedBusinessFunctionId !== null &&
            !isUuid(normalizedBusinessFunctionId)
        ) {
            return NextResponse.json(
                { error: 'Invalid business_function_id' },
                { status: 400 }
            )
        }

        if (
            normalizedBusinessUnitId !== undefined &&
            normalizedBusinessUnitId !== null &&
            !isUuid(normalizedBusinessUnitId)
        ) {
            return NextResponse.json(
                { error: 'Invalid business_unit_id' },
                { status: 400 }
            )
        }

        let normalizedRoleIds: string[] | undefined

        if (supported_role_ids !== undefined) {
            if (supported_role_ids === null) {
                normalizedRoleIds = []
            } else if (!Array.isArray(supported_role_ids)) {
                return NextResponse.json(
                    { error: 'supported_role_ids must be an array' },
                    { status: 400 }
                )
            } else {
                normalizedRoleIds = Array.from(
                    new Set(
                        supported_role_ids
                            .map(roleId => String(roleId).trim())
                            .filter(Boolean)
                    )
                )

                if (!normalizedRoleIds.every(isUuid)) {
                    return NextResponse.json(
                        { error: 'Invalid supported_role_ids' },
                        { status: 400 }
                    )
                }
            }
        }

        const { data: existingWorkflow, error: workflowCheckError } =
            await supabaseAdmin
                .from('workflows')
                .select('workflow_id')
                .eq('workflow_id', id)
                .maybeSingle()

        if (workflowCheckError) {
            return NextResponse.json(
                {
                    error: 'Failed to validate workflow',
                    detail: workflowCheckError.message,
                },
                { status: 500 }
            )
        }

        if (!existingWorkflow) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            )
        }

        if (normalizedBusinessFunctionId) {
            const { data: functionRecord, error: functionError } =
                await supabaseAdmin
                    .from('automation_functions')
                    .select('function_id')
                    .eq('function_id', normalizedBusinessFunctionId)
                    .maybeSingle()

            if (functionError) {
                return NextResponse.json(
                    {
                        error: 'Failed to validate business function',
                        detail: functionError.message,
                    },
                    { status: 500 }
                )
            }

            if (!functionRecord) {
                return NextResponse.json(
                    { error: 'Business function not found' },
                    { status: 400 }
                )
            }
        }

        if (normalizedBusinessUnitId) {
            const { data: businessUnitRecord, error: businessUnitError } =
                await supabaseAdmin
                    .from('automation_business_units')
                    .select('business_unit_id')
                    .eq('business_unit_id', normalizedBusinessUnitId)
                    .maybeSingle()

            if (businessUnitError) {
                return NextResponse.json(
                    {
                        error: 'Failed to validate business unit',
                        detail: businessUnitError.message,
                    },
                    { status: 500 }
                )
            }

            if (!businessUnitRecord) {
                return NextResponse.json(
                    { error: 'Business unit not found' },
                    { status: 400 }
                )
            }
        }

        if (normalizedRoleIds && normalizedRoleIds.length > 0) {
            const { data: roleRecords, error: rolesError } =
                await supabaseAdmin
                    .from('automation_roles')
                    .select('role_id')
                    .in('role_id', normalizedRoleIds)

            if (rolesError) {
                return NextResponse.json(
                    {
                        error: 'Failed to validate supported roles',
                        detail: rolesError.message,
                    },
                    { status: 500 }
                )
            }

            const foundRoleIds = new Set(
                (roleRecords || []).map(role => role.role_id)
            )

            const missingRoleIds = normalizedRoleIds.filter(
                roleId => !foundRoleIds.has(roleId)
            )

            if (missingRoleIds.length > 0) {
                return NextResponse.json(
                    {
                        error: 'One or more supported roles were not found',
                        missing_role_ids: missingRoleIds,
                    },
                    { status: 400 }
                )
            }
        }

        const updates: Record<string, string | null> = {}

        if (normalizedAutomationType !== undefined) {
            updates.automation_type = normalizedAutomationType
        }

        if (normalizedLifecycleStage !== undefined) {
            updates.lifecycle_stage = normalizedLifecycleStage
        }

        if (normalizedBusinessOwner !== undefined) {
            updates.business_owner = normalizedBusinessOwner
        }

        if (normalizedOperationalNotes !== undefined) {
            updates.operational_notes = normalizedOperationalNotes
        }

        if (normalizedBusinessFunctionId !== undefined) {
            updates.business_function_id = normalizedBusinessFunctionId
        }

        if (normalizedBusinessUnitId !== undefined) {
            updates.business_unit_id = normalizedBusinessUnitId
        }

        if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('workflows')
                .update(updates)
                .eq('workflow_id', id)

            if (updateError) {
                return NextResponse.json(
                    {
                        error: 'Failed to update workflow metadata',
                        detail: updateError.message,
                    },
                    { status: 500 }
                )
            }
        }

        if (normalizedRoleIds !== undefined) {
            const { error: deleteRolesError } = await supabaseAdmin
                .from('workflow_role_assignments')
                .delete()
                .eq('workflow_id', id)

            if (deleteRolesError) {
                return NextResponse.json(
                    {
                        error: 'Failed to clear existing supported roles',
                        detail: deleteRolesError.message,
                    },
                    { status: 500 }
                )
            }

            if (normalizedRoleIds.length > 0) {
                const roleAssignments = normalizedRoleIds.map(roleId => ({
                    workflow_id: id,
                    role_id: roleId,
                }))

                const { error: insertRolesError } = await supabaseAdmin
    .from('workflow_role_assignments')
    .upsert(roleAssignments, {
        onConflict: 'workflow_id,role_id',
        ignoreDuplicates: true,
    })

if (insertRolesError) {
    return NextResponse.json(
        {
            error: 'Failed to update supported roles',
            detail: insertRolesError.message,
        },
        { status: 500 }
    )
}
            }
        }

        const { data, error } = await supabaseAdmin
            .from('workflow_registry')
            .select(
                `
                workflow_id,
                automation_type,
                lifecycle_stage,
                business_owner,
                operational_notes,
                business_function_id,
                business_function_name,
                business_function_slug,
                supported_role_ids,
                supported_role_names,
                supported_role_slugs,
                business_unit_id,
                business_unit_name,
                business_unit_slug
                `
            )
            .eq('workflow_id', id)
            .single()

        if (error) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch updated workflow metadata',
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