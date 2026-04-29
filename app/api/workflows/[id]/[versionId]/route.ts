// app/api/workflows/[id]/[versionId]/route.ts

import { NextResponse } from 'next/server'

type RouteContext = {
    params: Promise<{
        id: string
        versionId: string
    }>
}

async function parseResponse(response: Response) {
    const text = await response.text()

    try {
        return text ? JSON.parse(text) : {}
    } catch {
        return { raw: text }
    }
}

export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const { id, versionId } = await context.params

        const baseUrl = process.env.N8N_BASE_URL
        const apiKey = process.env.N8N_API_KEY

        if (!baseUrl || !apiKey) {
            return NextResponse.json(
                { error: 'Missing N8N_BASE_URL or N8N_API_KEY' },
                { status: 500 }
            )
        }

        if (!id || !versionId) {
            return NextResponse.json(
                { error: 'Missing workflow id or version id' },
                { status: 400 }
            )
        }

        const cleanBaseUrl = baseUrl.replace(/\/$/, '')

        const response = await fetch(
            `${cleanBaseUrl}/workflows/${id}/${versionId}`,
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
                    error: 'Failed to fetch workflow version details',
                    status: response.status,
                    details: data,
                },
                { status: response.status }
            )
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Workflow version details error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}