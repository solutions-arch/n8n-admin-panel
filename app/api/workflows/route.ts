// app/api/workflows/route.ts

import { NextResponse } from 'next/server'

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

        const allWorkflows: any[] = []
        let cursor: string | null = null
        let page = 0

        /**
         * n8n supports a maximum limit of 250 per page.
         * We loop through pages using nextCursor until all workflows are fetched.
         */
        const limit = '250'
        const maxPages = 50

        do {
            const params = new URLSearchParams()
            params.set('limit', limit)

            if (cursor) {
                params.set('cursor', cursor)
            }

            const response = await fetch(`${baseUrl}/workflows?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'X-N8N-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                cache: 'no-store',
            })

            const text = await response.text()

            let data: any = {}

            try {
                data = text ? JSON.parse(text) : {}
            } catch {
                data = { raw: text }
            }

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

        return NextResponse.json(
            {
                data: allWorkflows,
                count: allWorkflows.length,
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