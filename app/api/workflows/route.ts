// app/api/workflows/route.ts

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('workflow_registry')
            .select(
                `
                workflow_id,
                workflow_name,
                active,
                archived,
                owner_project_id,
                version_id,
                last_modified_by,
                version_created_at,
                workflow_created_at,
                workflow_updated_at,
                synced_at,
                description,
                tags,
                automation_project_id,
                automation_project_name,
                automation_project_slug,
                project_implementation_stage,
                n8n_folder_id,
                n8n_folder_url,
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
            .order('workflow_updated_at', {
                ascending: false,
                nullsFirst: false,
            })

        if (error) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch workflows from Supabase',
                    detail: error.message,
                },
                { status: 500 }
            )
        }

        const workflows = (data || []).map(row => ({
            id: row.workflow_id,
            name: row.workflow_name,

            active: row.active,
            isArchived: row.archived,

            ownerProjectId: row.owner_project_id,
            versionId: row.version_id,
            activeVersionId: row.version_id,
            lastModifiedBy: row.last_modified_by,

            createdAt: row.workflow_created_at,
            updatedAt: row.workflow_updated_at,
            versionCreatedAt: row.version_created_at,
            syncedAt: row.synced_at,

            description: row.description,
            tags: row.tags || [],

            automation_project_id: row.automation_project_id,
            automation_project_name: row.automation_project_name,
            automation_project_slug: row.automation_project_slug,
            project_implementation_stage: row.project_implementation_stage,
            n8n_folder_id: row.n8n_folder_id,
            n8n_folder_url: row.n8n_folder_url,

            automation_type: row.automation_type,
            lifecycle_stage: row.lifecycle_stage,
            business_owner: row.business_owner,
            operational_notes: row.operational_notes,

            business_function_id: row.business_function_id,
            business_function_name: row.business_function_name,
            business_function_slug: row.business_function_slug,

            supported_role_ids: row.supported_role_ids || [],
            supported_role_names: row.supported_role_names || [],
            supported_role_slugs: row.supported_role_slugs || [],

            business_unit_id: row.business_unit_id,
            business_unit_name: row.business_unit_name,
            business_unit_slug: row.business_unit_slug,
        }))

        return NextResponse.json(
            {
                data: workflows,
                count: workflows.length,
                source: 'supabase',
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            }
        )
    } catch (error) {
        console.error('Supabase workflows fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}