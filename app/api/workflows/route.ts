// app/api/workflows/route.ts

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function parseResponse(response: Response) {
    const text = await response.text()

    try {
        return text ? JSON.parse(text) : {}
    } catch {
        return { raw: text }
    }
}

export async function GET() {
    try {
        const baseUrl = process.env.N8N_BASE_URL
        const apiKey = process.env.N8N_API_KEY

        if (!baseUrl || !apiKey) {
            return NextResponse.json(
                { error: 'Missing N8N_BASE_URL or N8N_API_KEY' },
                { status: 500 }
            )
        }

        const cleanBaseUrl = baseUrl.replace(/\/$/, '')

        const allWorkflows: any[] = []
        let cursor: string | null = null
        let page = 0

        const limit = '250'
        const maxPages = 50

        do {
            const params = new URLSearchParams()
            params.set('limit', limit)

            if (cursor) {
                params.set('cursor', cursor)
            }

            const response = await fetch(
                `${cleanBaseUrl}/workflows?${params.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        'X-N8N-API-KEY': apiKey,
                        Accept: 'application/json',
                    },
                    cache: 'no-store',
                }
            )

            const data = await parseResponse(response)

            if (!response.ok) {
                return NextResponse.json(
                    {
                        error: 'Failed to fetch workflows',
                        status: response.status,
                        page,
                        details: data,
                    },
                    { status: response.status }
                )
            }

            allWorkflows.push(...(data.data || []))

            cursor = data.nextCursor || null
            page += 1
        } while (cursor && page < maxPages)

        const workflowIds = allWorkflows
            .map(workflow => workflow.id)
            .filter(Boolean)

        let registryByWorkflowId: Record<string, any> = {}

        if (workflowIds.length > 0) {
            const { data: registryRows, error: registryError } = await supabaseAdmin
                .from('workflow_registry')
                .select(
                    `
                    workflow_id,
                    automation_project_id,
                    automation_project_name,
                    automation_project_slug,
                    project_implementation_stage,
                    n8n_folder_id,
                    n8n_folder_url
                    `
                )
                .in('workflow_id', workflowIds)

            if (registryError) {
                return NextResponse.json(
                    {
                        error: 'Failed to fetch workflow registry metadata',
                        detail: registryError.message,
                    },
                    { status: 500 }
                )
            }

            registryByWorkflowId = Object.fromEntries(
                (registryRows || []).map(row => [row.workflow_id, row])
            )
        }

        const enrichedWorkflows = allWorkflows.map(workflow => {
            const registry = registryByWorkflowId[workflow.id]

            return {
                ...workflow,

                automation_project_id: registry?.automation_project_id || null,
                automation_project_name: registry?.automation_project_name || null,
                automation_project_slug: registry?.automation_project_slug || null,
                project_implementation_stage:
                    registry?.project_implementation_stage || null,
                n8n_folder_id: registry?.n8n_folder_id || null,
                n8n_folder_url: registry?.n8n_folder_url || null,
            }
        })

        return NextResponse.json(
            {
                data: enrichedWorkflows,
                count: enrichedWorkflows.length,
                nextCursor: null,
                truncated: Boolean(cursor),
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            }
        )
    } catch (error) {
        console.error('n8n workflows fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}