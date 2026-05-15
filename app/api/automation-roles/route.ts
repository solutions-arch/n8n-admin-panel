// app/api/automation-roles/route.ts

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('automation_roles')
            .select(
                `
                role_id,
                role_name,
                role_slug,
                active,
                sort_order
                `
            )
            .eq('active', true)
            .order('role_name', { ascending: true })

        if (error) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch automation roles',
                    detail: error.message,
                },
                { status: 500 }
            )
        }

        return NextResponse.json(
            {
                data: data || [],
                count: data?.length || 0,
                source: 'supabase',
            },
            {
                headers: {
                    'Cache-Control': 'no-store',
                },
            }
        )
    } catch (error) {
        console.error('Automation roles fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}