// app/admin/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

type WorkflowStatusFilter = 'all' | 'active' | 'inactive'
type SortOption = 'name-asc' | 'name-desc' | 'active-first' | 'inactive-first'

function getN8nWorkflowUrl(workflowId: string) {
    const editorUrl = process.env.NEXT_PUBLIC_N8N_EDITOR_URL

    if (!editorUrl || !workflowId) {
        return null
    }

    const cleanEditorUrl = editorUrl.replace(/\/$/, '')

    return `${cleanEditorUrl}/workflow/${workflowId}`
}

export default function AdminPage() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortOption, setSortOption] = useState<SortOption>('name-asc')

    useEffect(() => {
        fetch('/api/workflows')
            .then(res => res.json())
            .then(data => {
                setWorkflows(data.data || [])
                setLoading(false)
            })
            .catch(error => {
                console.error('Failed to fetch workflows:', error)
                setLoading(false)
            })
    }, [])

    const totalWorkflows = workflows.length
    const activeWorkflows = workflows.filter(w => w.active).length
    const inactiveWorkflows = workflows.filter(w => !w.active).length

    const filteredWorkflows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return workflows
            .filter(wf => {
                if (statusFilter === 'active') return wf.active === true
                if (statusFilter === 'inactive') return wf.active === false
                return true
            })
            .filter(wf => {
                if (!query) return true

                const workflowName = String(wf.name || '').toLowerCase()
                const workflowId = String(wf.id || '').toLowerCase()

                return workflowName.includes(query) || workflowId.includes(query)
            })
            .sort((a, b) => {
                const nameA = String(a.name || '').toLowerCase()
                const nameB = String(b.name || '').toLowerCase()

                if (sortOption === 'name-asc') {
                    return nameA.localeCompare(nameB)
                }

                if (sortOption === 'name-desc') {
                    return nameB.localeCompare(nameA)
                }

                if (sortOption === 'active-first') {
                    if (a.active === b.active) return nameA.localeCompare(nameB)
                    return a.active ? -1 : 1
                }

                if (sortOption === 'inactive-first') {
                    if (a.active === b.active) return nameA.localeCompare(nameB)
                    return a.active ? 1 : -1
                }

                return 0
            })
    }, [workflows, statusFilter, searchQuery, sortOption])

    const toggleWorkflow = async (id: string, currentActive: boolean) => {
        setActionLoading(id)

        try {
            const res = await fetch(`/api/workflows/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !currentActive }),
            })

            if (res.ok) {
                setWorkflows(prev =>
                    prev.map(wf =>
                        wf.id === id ? { ...wf, active: !currentActive } : wf
                    )
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
            const res = await fetch(`/api/workflows/${id}`, {
                method: 'DELETE',
            })

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

    const clearSearchAndFilters = () => {
        setStatusFilter('all')
        setSearchQuery('')
        setSortOption('name-asc')
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-950">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                    Loading workflows...
                </p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Admin Panel
                </h2>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                    Manage your n8n workflows
                </p>
            </div>

            {/* Summary / Filters */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${statusFilter === 'all'
                            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                            : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                        }`}
                >
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Total
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {totalWorkflows}
                    </p>
                </button>

                <button
                    onClick={() => setStatusFilter('active')}
                    className={`rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${statusFilter === 'active'
                            ? 'border-green-400 bg-green-50 dark:border-green-500 dark:bg-green-950/40'
                            : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                        }`}
                >
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Active
                    </p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {activeWorkflows}
                    </p>
                </button>

                <button
                    onClick={() => setStatusFilter('inactive')}
                    className={`rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${statusFilter === 'inactive'
                            ? 'border-gray-400 bg-gray-100 dark:border-gray-500 dark:bg-gray-800'
                            : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                        }`}
                >
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Inactive
                    </p>
                    <p className="text-3xl font-bold text-gray-400 dark:text-gray-500">
                        {inactiveWorkflows}
                    </p>
                </button>
            </div>

            {/* Search / Sort */}
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search workflows..."
                            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-gray-500 dark:focus:ring-gray-800"
                        />

                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <select
                        value={sortOption}
                        onChange={e => setSortOption(e.target.value as SortOption)}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-gray-500 dark:focus:ring-gray-800"
                    >
                        <option value="name-asc">Sort: Name A–Z</option>
                        <option value="name-desc">Sort: Name Z–A</option>
                        <option value="active-first">Sort: Active first</option>
                        <option value="inactive-first">Sort: Inactive first</option>
                    </select>
                </div>

                {(statusFilter !== 'all' || searchQuery || sortOption !== 'name-asc') && (
                    <button
                        onClick={clearSearchAndFilters}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        Reset view
                    </button>
                )}
            </div>

            <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing{' '}
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                        {filteredWorkflows.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                        {workflows.length}
                    </span>{' '}
                    workflows
                    {statusFilter !== 'all' && (
                        <>
                            {' '}
                            · Filter:{' '}
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                                {statusFilter}
                            </span>
                        </>
                    )}
                </p>

                {statusFilter !== 'all' && (
                    <button
                        onClick={() => setStatusFilter('all')}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        Clear status filter
                    </button>
                )}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/80">
                            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Workflow
                            </th>
                            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Status
                            </th>
                            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Actions
                            </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {filteredWorkflows.map(wf => {
                            const workflowUrl = getN8nWorkflowUrl(wf.id)

                            return (
                                <tr
                                    key={wf.id}
                                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/70"
                                >
                                    <td className="p-4">
                                        <p className="font-medium text-gray-800 dark:text-gray-100">
                                            {wf.name}
                                        </p>
                                    </td>

                                    <td className="p-4">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${wf.active
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                                }`}
                                        >
                                            {wf.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>

                                    <td className="p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {workflowUrl && (
                                                <a
                                                    href={workflowUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                >
                                                    Open ↗
                                                </a>
                                            )}

                                            <button
                                                onClick={() => toggleWorkflow(wf.id, wf.active)}
                                                disabled={actionLoading === wf.id}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${wf.active
                                                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/60'
                                                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                                                    }`}
                                            >
                                                {actionLoading === wf.id
                                                    ? '...'
                                                    : wf.active
                                                        ? 'Deactivate'
                                                        : 'Activate'}
                                            </button>

                                            {confirmDelete === wf.id ? (
                                                <div className="flex flex-wrap items-center gap-1">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        Sure?
                                                    </span>

                                                    <button
                                                        onClick={() => deleteWorkflow(wf.id)}
                                                        disabled={actionLoading === wf.id}
                                                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        Yes, delete
                                                    </button>

                                                    <button
                                                        onClick={() => setConfirmDelete(null)}
                                                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmDelete(wf.id)}
                                                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}

                        {filteredWorkflows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={3}
                                    className="p-8 text-center text-sm text-gray-400 dark:text-gray-500"
                                >
                                    No workflows found for this search or filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}