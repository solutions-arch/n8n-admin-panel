// app/api/workflows/[id]/route.ts

import { NextResponse } from 'next/server'

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

function getN8nConfig() {
    const baseUrl = process.env.N8N_BASE_URL
    const apiKey = process.env.N8N_API_KEY

    if (!baseUrl || !apiKey) {
        return {
            error: NextResponse.json(
                { error: 'Missing N8N_BASE_URL or N8N_API_KEY' },
                { status: 500 }
            ),
        }
    }

    return {
        baseUrl: baseUrl.replace(/\/$/, ''),
        apiKey,
    }
}

async function parseResponse(response: Response) {
    const text = await response.text()

    try {
        return text ? JSON.parse(text) : {}
    } catch {
        return { raw: text }
    }
}

export async function PATCH(
    request: Request,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json()

        const config = getN8nConfig()

        if ('error' in config) {
            return config.error
        }

        const shouldActivate = Boolean(body.active)
        const action = shouldActivate ? 'activate' : 'deactivate'

        const response = await fetch(`${config.baseUrl}/workflows/${id}/${action}`, {
            method: 'POST',
            headers: {
                'X-N8N-API-KEY': config.apiKey,
                Accept: 'application/json',
            },
            cache: 'no-store',
        })

        const data = await parseResponse(response)

        if (!response.ok) {
            return NextResponse.json(
                {
                    error: `Failed to ${action} workflow`,
                    status: response.status,
                    details: data,
                },
                { status: response.status }
            )
        }

        return NextResponse.json({
            success: true,
            id,
            active: shouldActivate,
            action,
            details: data,
        })
    } catch (error) {
        console.error('Workflow PATCH error:', error)

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

        const config = getN8nConfig()

        if ('error' in config) {
            return config.error
        }

        const response = await fetch(`${config.baseUrl}/workflows/${id}`, {
            method: 'DELETE',
            headers: {
                'X-N8N-API-KEY': config.apiKey,
                Accept: 'application/json',
            },
            cache: 'no-store',
        })

        const data = await parseResponse(response)

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
        console.error('Workflow DELETE error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}