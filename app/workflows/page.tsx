// app/workflows/page.tsx
'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'

type SortOption =
    | 'updated-desc'
    | 'updated-asc'
    | 'created-desc'
    | 'created-asc'
    | 'name-asc'
    | 'name-desc'
    | 'active-first'
    | 'inactive-first'
    | 'archived-first'

type StatusFilter = 'all' | 'active' | 'inactive' | 'archived'

function getN8nEditorUrl() {
    const editorUrl = process.env.NEXT_PUBLIC_N8N_EDITOR_URL

    if (!editorUrl) return null

    return editorUrl.replace(/\/$/, '')
}

function getN8nWorkflowUrl(workflowId: string) {
    const editorUrl = getN8nEditorUrl()

    if (!editorUrl || !workflowId) return null

    return `${editorUrl}/workflow/${workflowId}`
}

function formatDate(value: string | null | undefined) {
    if (!value) return '—'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleString()
}

function getTagNames(workflow: any) {
    if (!Array.isArray(workflow.tags)) return []

    return workflow.tags
        .map((tag: any) => {
            if (typeof tag === 'string') return tag
            return tag?.name || tag?.tagName || ''
        })
        .filter(Boolean)
}

function getVersionId(workflow: any) {
    return (
        workflow.versionId ||
        workflow.activeVersionId ||
        workflow.version?.id ||
        workflow.activeVersion?.id ||
        null
    )
}

function getAuthorName(value: any) {
    if (!value) return null

    if (typeof value === 'string') {
        return value.trim() || null
    }

    if (Array.isArray(value)) {
        const names = value
            .map(author => {
                if (typeof author === 'string') return author
                return author?.name || author?.email || ''
            })
            .filter(Boolean)

        return names.length > 0 ? names.join(', ') : null
    }

    if (typeof value === 'object') {
        return value.name || value.email || null
    }

    return null
}

function getVersionAuthors(workflow: any, versionDetails?: any) {
    const fromVersion =
        getAuthorName(versionDetails?.authors) ||
        getAuthorName(versionDetails?.author) ||
        getAuthorName(versionDetails?.activeVersion?.authors)

    const fromList =
        getAuthorName(workflow.activeVersion?.authors) ||
        getAuthorName(workflow.version?.authors) ||
        getAuthorName(workflow.authors)

    return fromVersion || fromList || null
}

function getWorkflowDescription(workflow: any, versionDetails?: any) {
    return (
        versionDetails?.description ||
        versionDetails?.activeVersion?.description ||
        workflow.description ||
        workflow.activeVersion?.description ||
        null
    )
}

function getEstimatedTimeSaved(workflow: any, versionDetails?: any) {
    const settings =
        versionDetails?.settings ||
        versionDetails?.activeVersion?.settings ||
        workflow?.settings ||
        workflow?.activeVersion?.settings ||
        {}

    const minutes =
        settings.timeSavedPerExecution ??
        settings.estimatedTimeSaved ??
        settings.timeSaved ??
        settings.timeSavedInMinutes ??
        settings.timeSavedValue ??
        null

    const mode = settings.timeSavedMode || null

    return {
        minutes,
        mode,
    }
}

function formatEstimatedTimeSaved(minutes: any) {
    if (minutes === null || minutes === undefined || minutes === '') {
        return 'No estimated time saved set.'
    }

    const numericMinutes = Number(minutes)

    if (Number.isNaN(numericMinutes)) {
        return String(minutes)
    }

    return `${numericMinutes} minute${numericMinutes === 1 ? '' : 's'} per execution`
}

async function fetchJson(url: string) {
    const res = await fetch(url)

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Request failed: ${res.status} ${text}`)
    }

    const text = await res.text()
    return text ? JSON.parse(text) : {}
}

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [sortOption, setSortOption] = useState<SortOption>('updated-desc')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

    const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null)
    const [versionDetails, setVersionDetails] = useState<Record<string, any>>({})
    const [versionLoadingId, setVersionLoadingId] = useState<string | null>(null)
    const [versionError, setVersionError] = useState<Record<string, string>>({})

    const loadWorkflows = async () => {
        setRefreshing(true)
        setErrorMessage(null)

        try {
            const data = await fetchJson('/api/workflows')

            setWorkflows(data.data || [])
            setLastRefreshed(new Date())

            // Clear cached version details so updated descriptions/time-saved values can reload
            setVersionDetails({})
            setVersionError({})
            setExpandedWorkflowId(null)
        } catch (error) {
            console.error('Failed to fetch workflows:', error)
            setErrorMessage('Failed to fetch workflows.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        loadWorkflows()
    }, [])

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
            } else {
                const text = await res.text()
                console.error('Failed to toggle workflow:', text)
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
            } else {
                const text = await res.text()
                console.error('Failed to delete workflow:', text)
            }
        } catch (error) {
            console.error('Failed to delete workflow:', error)
        } finally {
            setActionLoading(null)
            setConfirmDelete(null)
        }
    }

    const loadVersionDetails = async (workflow: any) => {
        const workflowId = workflow.id
        const versionId = getVersionId(workflow)

        if (!workflowId || !versionId) {
            setVersionError(prev => ({
                ...prev,
                [workflowId]: 'No version ID available for this workflow.',
            }))
            setExpandedWorkflowId(workflowId)
            return
        }

        if (versionDetails[workflowId]) {
            setExpandedWorkflowId(expandedWorkflowId === workflowId ? null : workflowId)
            return
        }

        setVersionLoadingId(workflowId)
        setVersionError(prev => ({
            ...prev,
            [workflowId]: '',
        }))

        try {
            const data = await fetchJson(`/api/workflows/${workflowId}/${versionId}`)

            setVersionDetails(prev => ({
                ...prev,
                [workflowId]: data,
            }))

            setExpandedWorkflowId(workflowId)
        } catch (error) {
            console.error('Failed to fetch workflow version details:', error)

            setVersionError(prev => ({
                ...prev,
                [workflowId]: 'Failed to load version details.',
            }))

            setExpandedWorkflowId(workflowId)
        } finally {
            setVersionLoadingId(null)
        }
    }

    const totalWorkflows = workflows.length
    const activeWorkflows = workflows.filter(wf => wf.active).length
    const inactiveWorkflows = workflows.filter(wf => !wf.active).length
    const archivedWorkflows = workflows.filter(wf => wf.isArchived).length

    const filteredWorkflows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return workflows
            .filter(workflow => {
                if (statusFilter === 'active') return workflow.active === true
                if (statusFilter === 'inactive') return workflow.active === false
                if (statusFilter === 'archived') return workflow.isArchived === true
                return true
            })
            .filter(workflow => {
                if (!query) return true

                const name = String(workflow.name || '').toLowerCase()
                const id = String(workflow.id || '').toLowerCase()
                const tags = getTagNames(workflow).join(' ').toLowerCase()
                const versionId = String(getVersionId(workflow) || '').toLowerCase()
                const description = String(
                    getWorkflowDescription(workflow, versionDetails[workflow.id]) || ''
                ).toLowerCase()
                const versionAuthors = String(
                    getVersionAuthors(workflow, versionDetails[workflow.id]) || ''
                ).toLowerCase()

                return (
                    name.includes(query) ||
                    id.includes(query) ||
                    tags.includes(query) ||
                    versionId.includes(query) ||
                    description.includes(query) ||
                    versionAuthors.includes(query)
                )
            })
            .sort((a, b) => {
                const nameA = String(a.name || '').toLowerCase()
                const nameB = String(b.name || '').toLowerCase()

                const updatedA = new Date(a.updatedAt || 0).getTime()
                const updatedB = new Date(b.updatedAt || 0).getTime()

                const createdA = new Date(a.createdAt || 0).getTime()
                const createdB = new Date(b.createdAt || 0).getTime()

                if (sortOption === 'updated-desc') return updatedB - updatedA
                if (sortOption === 'updated-asc') return updatedA - updatedB
                if (sortOption === 'created-desc') return createdB - createdA
                if (sortOption === 'created-asc') return createdA - createdB
                if (sortOption === 'name-asc') return nameA.localeCompare(nameB)
                if (sortOption === 'name-desc') return nameB.localeCompare(nameA)

                if (sortOption === 'active-first') {
                    if (a.active === b.active) return nameA.localeCompare(nameB)
                    return a.active ? -1 : 1
                }

                if (sortOption === 'inactive-first') {
                    if (a.active === b.active) return nameA.localeCompare(nameB)
                    return a.active ? 1 : -1
                }

                if (sortOption === 'archived-first') {
                    if (a.isArchived === b.isArchived) return nameA.localeCompare(nameB)
                    return a.isArchived ? -1 : 1
                }

                return 0
            })
    }, [workflows, searchQuery, sortOption, statusFilter, versionDetails])

    const clearFilters = () => {
        setSearchQuery('')
        setStatusFilter('all')
        setSortOption('updated-desc')
    }

    const editorUrl = getN8nEditorUrl()

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-950">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                    Loading workflows...
                </p>
            </div>
        )
    }

    if (errorMessage && workflows.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
                <div className="rounded-xl border border-red-100 bg-white p-6 shadow-sm dark:border-red-900 dark:bg-gray-900">
                    <p className="mb-2 font-semibold text-red-600 dark:text-red-400">
                        Workflows Error
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {errorMessage}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Workflows
                    </h2>

                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                        Showing {filteredWorkflows.length} of {totalWorkflows} workflows
                        {lastRefreshed &&
                            ` · Last refreshed ${lastRefreshed.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                            })}`}
                    </p>

                    {errorMessage && (
                        <p className="mt-2 text-sm text-red-500">
                            {errorMessage}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {editorUrl && (
                        <a
                            href={editorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-fit items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            Open n8n ↗
                        </a>
                    )}

                    <button
                        onClick={loadWorkflows}
                        disabled={refreshing}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
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

                <button
                    onClick={() => setStatusFilter('archived')}
                    className={`rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${statusFilter === 'archived'
                        ? 'border-orange-400 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/40'
                        : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                        }`}
                >
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Archived
                    </p>
                    <p className="text-3xl font-bold text-orange-500 dark:text-orange-400">
                        {archivedWorkflows}
                    </p>
                </button>
            </div>

            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-xl">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by workflow name, ID, tag, author, or description..."
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

                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <select
                        value={sortOption}
                        onChange={e => setSortOption(e.target.value as SortOption)}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-gray-500 dark:focus:ring-gray-800"
                    >
                        <option value="updated-desc">Sort: Recently updated</option>
                        <option value="updated-asc">Sort: Oldest updated</option>
                        <option value="created-desc">Sort: Recently created</option>
                        <option value="created-asc">Sort: Oldest created</option>
                        <option value="name-asc">Sort: Name A–Z</option>
                        <option value="name-desc">Sort: Name Z–A</option>
                        <option value="active-first">Sort: Active first</option>
                        <option value="inactive-first">Sort: Inactive first</option>
                        <option value="archived-first">Sort: Archived first</option>
                    </select>

                    {(searchQuery || statusFilter !== 'all' || sortOption !== 'updated-desc') && (
                        <button
                            onClick={clearFilters}
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            Reset view
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1250px] text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/80">
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Workflow
                                </th>
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Status
                                </th>
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Archive
                                </th>
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Tags
                                </th>
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Created
                                </th>
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Last Updated
                                </th>
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {filteredWorkflows.map(workflow => {
                                const workflowUrl = getN8nWorkflowUrl(workflow.id)
                                const tags = getTagNames(workflow)
                                const workflowVersionDetails = versionDetails[workflow.id]
                                const versionId = getVersionId(workflow)
                                const isExpanded = expandedWorkflowId === workflow.id
                                const description = getWorkflowDescription(
                                    workflow,
                                    workflowVersionDetails
                                )
                                const estimatedTimeSaved = getEstimatedTimeSaved(
                                    workflow,
                                    workflowVersionDetails
                                )
                                const versionAuthors = getVersionAuthors(
                                    workflow,
                                    workflowVersionDetails
                                )

                                return (
                                    <Fragment key={workflow.id}>
                                        <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/70">
                                            <td className="p-4">
                                                <p className="font-medium text-gray-800 dark:text-gray-100">
                                                    {workflow.name}
                                                </p>
                                                <p className="mt-1 font-mono text-xs text-gray-300 dark:text-gray-600">
                                                    {workflow.id}
                                                </p>
                                            </td>

                                            <td className="p-4">
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workflow.active
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                                        }`}
                                                >
                                                    {workflow.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workflow.isArchived
                                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                                                        : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                                                        }`}
                                                >
                                                    {workflow.isArchived ? 'Archived' : 'Current'}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <div className="flex max-w-xs flex-wrap gap-1">
                                                    {tags.length > 0 ? (
                                                        tags.map(tag => (
                                                            <span
                                                                key={`${workflow.id}-${tag}`}
                                                                className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            —
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-4 text-xs text-gray-400 dark:text-gray-500">
                                                {formatDate(workflow.createdAt)}
                                            </td>

                                            <td className="p-4 text-xs text-gray-400 dark:text-gray-500">
                                                {formatDate(workflow.updatedAt)}
                                            </td>

                                            <td className="p-4">
                                                <div className="flex min-w-[230px] flex-col gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {workflowUrl && (
                                                            <a
                                                                href={workflowUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                                            >
                                                                Open ↗
                                                            </a>
                                                        )}

                                                        <button
                                                            onClick={() => loadVersionDetails(workflow)}
                                                            disabled={versionLoadingId === workflow.id}
                                                            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${isExpanded
                                                                    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60'
                                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                                                                }`}
                                                        >
                                                            {versionLoadingId === workflow.id
                                                                ? 'Loading...'
                                                                : isExpanded
                                                                    ? 'Hide Details'
                                                                    : 'View Details'}
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button
                                                            onClick={() =>
                                                                toggleWorkflow(workflow.id, workflow.active)
                                                            }
                                                            disabled={actionLoading === workflow.id}
                                                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${workflow.active
                                                                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/60'
                                                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                                                                }`}
                                                        >
                                                            {actionLoading === workflow.id
                                                                ? '...'
                                                                : workflow.active
                                                                    ? 'Deactivate'
                                                                    : 'Activate'}
                                                        </button>

                                                        {confirmDelete === workflow.id ? (
                                                            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 dark:border-red-900 dark:bg-red-950/30">
                                                                <span className="text-xs text-red-600 dark:text-red-300">
                                                                    Delete?
                                                                </span>

                                                                <button
                                                                    onClick={() => deleteWorkflow(workflow.id)}
                                                                    disabled={actionLoading === workflow.id}
                                                                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                                >
                                                                    Yes
                                                                </button>

                                                                <button
                                                                    onClick={() => setConfirmDelete(null)}
                                                                    className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setConfirmDelete(workflow.id)}
                                                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="bg-gray-50 p-4 dark:bg-gray-950/60"
                                                >
                                                    <div className="rounded-lg border border-gray-100 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
                                                        <div className="grid gap-4 md:grid-cols-5">
                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                    Version ID
                                                                </p>
                                                                <p className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-300">
                                                                    {versionId || '—'}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                    Version Created
                                                                </p>
                                                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                                                    {formatDate(
                                                                        workflowVersionDetails?.createdAt ||
                                                                        workflowVersionDetails?.activeVersion
                                                                            ?.createdAt ||
                                                                        workflow.activeVersion?.createdAt
                                                                    )}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                    Version Updated
                                                                </p>
                                                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                                                    {formatDate(
                                                                        workflowVersionDetails?.updatedAt ||
                                                                        workflowVersionDetails?.activeVersion
                                                                            ?.updatedAt ||
                                                                        workflow.activeVersion?.updatedAt
                                                                    )}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                    Version Author(s)
                                                                </p>
                                                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                                                    {versionAuthors || 'No author metadata returned.'}
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                    Estimated Time Saved
                                                                </p>
                                                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                                                    {formatEstimatedTimeSaved(
                                                                        estimatedTimeSaved.minutes
                                                                    )}
                                                                    {estimatedTimeSaved.mode
                                                                        ? ` · Mode: ${estimatedTimeSaved.mode}`
                                                                        : ''}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                                                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                Description
                                                            </p>

                                                            <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
                                                                {description || 'No description added yet.'}
                                                            </p>
                                                        </div>

                                                        {versionError[workflow.id] && (
                                                            <p className="mt-3 text-xs text-red-500">
                                                                {versionError[workflow.id]}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                )
                            })}

                            {filteredWorkflows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
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
        </div>
    )
}