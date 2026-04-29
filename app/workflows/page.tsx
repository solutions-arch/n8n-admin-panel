// app/workflows/page.tsx
'use client'

import { useEffect, useState } from 'react'

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/workflows')
            .then(res => res.json())
            .then(data => {
                setWorkflows(data.data || [])
                setLoading(false)
            })
    }, [])

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <p className="text-gray-400 text-sm">Loading workflows...</p>
        </div>
    )

    return (
        <div className="p-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Workflows</h2>
                <p className="text-sm text-gray-400 mt-1">{workflows.length} workflows found</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Updated</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {workflows.map(wf => (
                            <tr key={wf.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-medium text-gray-800">{wf.name}</td>
                                <td className="p-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${wf.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {wf.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-400 text-xs">
                                    {wf.createdAt ? new Date(wf.createdAt).toLocaleString() : '—'}
                                </td>
                                <td className="p-4 text-gray-400 text-xs">
                                    {wf.updatedAt ? new Date(wf.updatedAt).toLocaleString() : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}