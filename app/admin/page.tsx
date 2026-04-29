// app/admin/page.tsx
'use client'

import { useEffect, useState } from 'react'

export default function AdminPage() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/workflows')
            .then(res => res.json())
            .then(data => {
                setWorkflows(data.data || [])
                setLoading(false)
            })
    }, [])

    const toggleWorkflow = async (id: string, currentActive: boolean) => {
        setActionLoading(id)
        try {
            const res = await fetch(`/api/workflows/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !currentActive })
            })
            if (res.ok) {
                setWorkflows(prev =>
                    prev.map(wf => wf.id === id ? { ...wf, active: !currentActive } : wf)
                )
            }
        } catch (error) {
            console.error('Failed to toggle workflow:', error)
        } finally {
            setActionLoading(null)
        }
    }

    const deleteWorkflow = async (id: string) => {
        setActionLoading(id)
        try {
            const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setWorkflows(prev => prev.filter(wf => wf.id !== id))
            }
        } catch (error) {
            console.error('Failed to delete workflow:', error)
        } finally {
            setActionLoading(null)
            setConfirmDelete(null)
        }
    }

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <p className="text-gray-400 text-sm">Loading workflows...</p>
        </div>
    )

    return (
        <div className="p-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
                <p className="text-sm text-gray-400 mt-1">Manage your n8n workflows</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Total</p>
                    <p className="text-3xl font-bold text-gray-900">{workflows.length}</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Active</p>
                    <p className="text-3xl font-bold text-green-600">{workflows.filter(w => w.active).length}</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Inactive</p>
                    <p className="text-3xl font-bold text-gray-400">{workflows.filter(w => !w.active).length}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Workflow</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {workflows.map(wf => (
                            <tr key={wf.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <p className="font-medium text-gray-800">{wf.name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{wf.id}</p>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${wf.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {wf.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        {/* Toggle Button */}
                                        <button
                                            onClick={() => toggleWorkflow(wf.id, wf.active)}
                                            disabled={actionLoading === wf.id}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${wf.active
                                                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                }`}
                                        >
                                            {actionLoading === wf.id ? '...' : wf.active ? 'Deactivate' : 'Activate'}
                                        </button>

                                        {/* Delete Button */}
                                        {confirmDelete === wf.id ? (
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-gray-500">Sure?</span>
                                                <button
                                                    onClick={() => deleteWorkflow(wf.id)}
                                                    disabled={actionLoading === wf.id}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    Yes, delete
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(null)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDelete(wf.id)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}