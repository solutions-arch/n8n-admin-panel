// app/api/workflows/[id]/route.ts

import { NextResponse } from 'next/server'

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

export async function PATCH(
    request: Request,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json()

        const baseUrl = process.env.N8N_BASE_URL
        const apiKey = process.env.N8N_API_KEY

        if (!baseUrl || !apiKey) {
            return NextResponse.json(
                { error: 'Missing N8N_BASE_URL or N8N_API_KEY' },
                { status: 500 }
            )
        }

        const response = await fetch(`${baseUrl}/workflows/${id}`, {
            method: 'PATCH',
            headers: {
                'X-N8N-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
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
                    error: 'Failed to update workflow',
                    status: response.status,
                    details: data,
                },
                { status: response.status }
            )
        }

        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    context: RouteContext
) {
    try {
        const { id } = await context.params

        const baseUrl = process.env.N8N_BASE_URL
        const apiKey = process.env.N8N_API_KEY

        if (!baseUrl || !apiKey) {
            return NextResponse.json(
                { error: 'Missing N8N_BASE_URL or N8N_API_KEY' },
                { status: 500 }
            )
        }

        const response = await fetch(`${baseUrl}/workflows/${id}`, {
            method: 'DELETE',
            headers: {
                'X-N8N-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
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
                    error: 'Failed to delete workflow',
                    status: response.status,
                    details: data,
                },
                { status: response.status }
            )
        }

        return NextResponse.json({
            success: true,
            id,
            details: data,
        })
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}