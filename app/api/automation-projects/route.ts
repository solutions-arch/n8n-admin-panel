import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('automation_projects')
            .select(
                `
                automation_project_id,
                project_name,
                project_slug,
                project_description,
                operational_purpose,
                implementation_stage,
                notes,
                n8n_parent_project_id,
                n8n_parent_project_name,
                n8n_folder_id,
                n8n_folder_name,
                n8n_folder_url,
                source,
                sync_status,
                created_at,
                updated_at
                `
            )
            .order('project_name', { ascending: true })

        if (error) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch automation projects',
                    detail: error.message,
                },
                { status: 500 }
            )
        }

        return NextResponse.json(
            {
                data: data || [],
                count: data?.length || 0,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            }
        )
    } catch (error) {
        console.error('Automation projects fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}