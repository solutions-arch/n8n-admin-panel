// app/api/executions/route.ts

import { NextResponse } from 'next/server'

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

        const n8nParams = new URLSearchParams()

        n8nParams.set('limit', limit)
        n8nParams.set('includeData', 'false')

        if (cursor) {
            n8nParams.set('cursor', cursor)
        }

        const url = `${baseUrl}/executions?${n8nParams.toString()}`

        const response = await fetch(url, {
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
                    error: 'Failed to fetch executions',
                    status: response.status,
                    details: data,
                },
                { status: response.status }
            )
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('n8n fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}