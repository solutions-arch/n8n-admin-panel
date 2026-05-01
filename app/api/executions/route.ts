// app/api/executions/route.ts

import { NextResponse } from 'next/server'

async function parseResponse(response: Response) {
    const text = await response.text()

    try {
        return text ? JSON.parse(text) : {}
    } catch {
        return { raw: text }
    }
}

export async function GET(request: Request) {
    try {
        const baseUrl = process.env.N8N_BASE_URL
        const apiKey = process.env.N8N_API_KEY

        if (!baseUrl || !apiKey) {
            return NextResponse.json(
                { error: 'Missing N8N_BASE_URL or N8N_API_KEY' },
                { status: 500 }
            )
        }

        const { searchParams } = new URL(request.url)

        const cursor = searchParams.get('cursor')
        const limit = searchParams.get('limit') || '50'

        const cleanBaseUrl = baseUrl.replace(/\/$/, '')

        const n8nParams = new URLSearchParams()
        n8nParams.set('limit', limit)
        n8nParams.set('includeData', 'false')

        if (cursor) {
            n8nParams.set('cursor', cursor)
        }

        const response = await fetch(
            `${cleanBaseUrl}/executions?${n8nParams.toString()}`,
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
                    error: 'Failed to fetch executions',
                    status: response.status,
                    details: data,
                },
                { status: response.status }
            )
        }

        const executions = Array.isArray(data.data) ? data.data : []

        const nextCursor =
            data.nextCursor ||
            data.next_cursor ||
            data.pagination?.nextCursor ||
            data.pagination?.next_cursor ||
            null

        return NextResponse.json(
            {
                data: executions,
                count: executions.length,
                nextCursor,
                hasMore: Boolean(nextCursor),
                debug:
                    process.env.NODE_ENV === 'development'
                        ? {
                            rawKeys: Object.keys(data || {}),
                            receivedCursor: cursor || null,
                            requestedLimit: limit,
                            n8nReturnedNextCursor: data.nextCursor || null,
                        }
                        : undefined,
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            }
        )
    } catch (error) {
        console.error('n8n executions fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}