import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json(
        {
            data: [],
            message: 'Recent operations route is not implemented yet.',
        },
        {
            headers: {
                'Cache-Control': 'no-store',
            },
        }
    )
}