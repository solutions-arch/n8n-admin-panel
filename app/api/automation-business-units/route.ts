// app/api/automation-business-units/route.ts

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('automation_business_units')
            .select(
                `
                business_unit_id,
                business_unit_name,
                business_unit_slug,
                description,
                active,
                sort_order
                `
            )
            .eq('active', true)
            .order('business_unit_name', { ascending: true })

        if (error) {
            return NextResponse.json(
                {
                    error: 'Failed to fetch automation business units',
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
        console.error('Automation business units fetch error:', error)

        return NextResponse.json(
            {
                error: 'Internal server error',
                detail: String(error),
            },
            { status: 500 }
        )
    }
}