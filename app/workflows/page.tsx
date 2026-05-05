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
type TypeFilter = 'all' | 'Workflow' | 'AI Agent'
type StageFilter =
    | 'all'
    | 'Production'
    | 'Development'
    | 'Paused/Retired'
    | 'Ad hoc'

type ProjectFilter = string

const TYPE_TAGS = ['Workflow', 'AI Agent']
const STAGE_TAGS = ['Production', 'Development', 'Paused/Retired', 'Ad hoc']
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50]

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

    return date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    })
}

type WorkflowTag = string | {
    name?: string
    tagName?: string
}

function getTagNames(workflow: any): string[] {
    if (!Array.isArray(workflow.tags)) return []

    return workflow.tags
        .map((tag: WorkflowTag) => {
            if (typeof tag === 'string') return tag
            return tag.name || tag.tagName || ''
        })
        .filter((tag: string) => Boolean(tag))
}

function normalizeTag(tag: string): string {
    return tag.trim().toLowerCase()
}

function hasTag(workflow: any, tagName: string): boolean {
    const tags = getTagNames(workflow).map((tag: string) => normalizeTag(tag))
    return tags.includes(normalizeTag(tagName))
}

function isTypeTag(tag: string) {
    return TYPE_TAGS.some(typeTag => normalizeTag(typeTag) === normalizeTag(tag))
}

function isStageTag(tag: string) {
    return STAGE_TAGS.some(stageTag => normalizeTag(stageTag) === normalizeTag(tag))
}

function isProjectTag(tag: string) {
    return !isTypeTag(tag) && !isStageTag(tag)
}

function getProjectTagsFromWorkflow(workflow: any) {
    return getTagNames(workflow).filter(isProjectTag)
}

function getAllProjects(workflows: any[]) {
    const uniqueProjects = new Set<string>()

    workflows.forEach(workflow => {
        getProjectTagsFromWorkflow(workflow).forEach(projectTag => {
            uniqueProjects.add(projectTag)
        })
    })

    return Array.from(uniqueProjects).sort((a, b) => a.localeCompare(b))
}

function workflowHasProject(workflow: any, project: string) {
    return getProjectTagsFromWorkflow(workflow).some(
        projectTag => normalizeTag(projectTag) === normalizeTag(project)
    )
}

function isUncategorizedWorkflow(workflow: any) {
    return getProjectTagsFromWorkflow(workflow).length === 0
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

function MetricCard({
    label,
    value,
    active,
    onClick,
    colorClass = 'text-gray-900 dark:text-gray-100',
}: {
    label: string
    value: number
    active?: boolean
    onClick?: () => void
    colorClass?: string
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-xl border p-5 text-left shadow-sm transition hover:shadow-md ${active
                ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                }`}
        >
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {label}
            </p>
            <p className={`text-3xl font-bold ${colorClass}`}>
                {value}
            </p>
        </button>
    )
}

function CompactMetricCard({
    label,
    value,
    active,
    onClick,
    badgeClass = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
}: {
    label: string
    value: number
    active?: boolean
    onClick?: () => void
    badgeClass?: string
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-xl border p-4 text-left transition hover:shadow-md ${active
                ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'
                }`}
        >
            <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>
                    {label}
                </span>

                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {value}
                </span>
            </div>
        </button>
    )
}

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [sortOption, setSortOption] = useState<SortOption>('updated-desc')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
    const [stageFilter, setStageFilter] = useState<StageFilter>('all')
    const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all')
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

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

            setVersionDetails({})
            setVersionError({})
            setExpandedWorkflowId(null)
            setCurrentPage(1)
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

    useEffect(() => {
        setCurrentPage(1)
    }, [
        searchQuery,
        sortOption,
        statusFilter,
        typeFilter,
        stageFilter,
        projectFilter,
        pageSize,
    ])

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
            const [workflowDetailResult, versionDetailResult] = await Promise.allSettled([
                fetchJson(`/api/workflows/${workflowId}`),
                fetchJson(`/api/workflows/${workflowId}/${versionId}`),
            ])

            const workflowDetail =
                workflowDetailResult.status === 'fulfilled'
                    ? workflowDetailResult.value
                    : {}

            const versionDetail =
                versionDetailResult.status === 'fulfilled'
                    ? versionDetailResult.value
                    : {}

            const mergedDetails = {
                ...workflowDetail,
                ...versionDetail,
                description:
                    workflowDetail.description ||
                    workflowDetail.activeVersion?.description ||
                    versionDetail.description ||
                    versionDetail.activeVersion?.description ||
                    null,
                settings: {
                    ...(workflowDetail.settings || {}),
                    ...(versionDetail.settings || {}),
                },
            }

            setVersionDetails(prev => ({
                ...prev,
                [workflowId]: mergedDetails,
            }))

            setExpandedWorkflowId(workflowId)
        } catch (error) {
            console.error('Failed to fetch workflow details:', error)

            setVersionError(prev => ({
                ...prev,
                [workflowId]: 'Failed to load workflow details.',
            }))

            setExpandedWorkflowId(workflowId)
        } finally {
            setVersionLoadingId(null)
        }
    }

    const allProjects = useMemo(() => {
        return getAllProjects(workflows)
    }, [workflows])

    const projectScopedWorkflows = useMemo(() => {
        return workflows.filter(workflow => {
            if (projectFilter === 'all') return true
            if (projectFilter === 'uncategorized') return isUncategorizedWorkflow(workflow)

            return workflowHasProject(workflow, projectFilter)
        })
    }, [workflows, projectFilter])

    const operationalCounts = useMemo(() => {
        return {
            total: projectScopedWorkflows.length,
            active: projectScopedWorkflows.filter(wf => wf.active).length,
            disabled: projectScopedWorkflows.filter(wf => !wf.active).length,
            archived: projectScopedWorkflows.filter(wf => wf.isArchived).length,
        }
    }, [projectScopedWorkflows])

    const typeCounts = useMemo(() => {
        return {
            workflow: projectScopedWorkflows.filter(workflow =>
                hasTag(workflow, 'Workflow')
            ).length,
            aiAgent: projectScopedWorkflows.filter(workflow =>
                hasTag(workflow, 'AI Agent')
            ).length,
        }
    }, [projectScopedWorkflows])

    const stageCounts = useMemo(() => {
        return {
            production: projectScopedWorkflows.filter(workflow =>
                hasTag(workflow, 'Production')
            ).length,
            development: projectScopedWorkflows.filter(workflow =>
                hasTag(workflow, 'Development')
            ).length,
            pausedRetired: projectScopedWorkflows.filter(workflow =>
                hasTag(workflow, 'Paused/Retired')
            ).length,
            adHoc: projectScopedWorkflows.filter(workflow =>
                hasTag(workflow, 'Ad hoc')
            ).length,
        }
    }, [projectScopedWorkflows])

    const filteredWorkflows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return projectScopedWorkflows
            .filter(workflow => {
                if (statusFilter === 'active') return workflow.active === true
                if (statusFilter === 'inactive') return workflow.active === false
                if (statusFilter === 'archived') return workflow.isArchived === true
                return true
            })
            .filter(workflow => {
                if (typeFilter === 'all') return true
                return hasTag(workflow, typeFilter)
            })
            .filter(workflow => {
                if (stageFilter === 'all') return true
                return hasTag(workflow, stageFilter)
            })
            .filter(workflow => {
                if (!query) return true

                const name = String(workflow.name || '').toLowerCase()
                const id = String(workflow.id || '').toLowerCase()
                const tags = getTagNames(workflow).join(' ').toLowerCase()
                const projects = getProjectTagsFromWorkflow(workflow).join(' ').toLowerCase()
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
                    projects.includes(query) ||
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
    }, [
        projectScopedWorkflows,
        searchQuery,
        sortOption,
        statusFilter,
        typeFilter,
        stageFilter,
        versionDetails,
    ])

    const totalPages = Math.max(1, Math.ceil(filteredWorkflows.length / pageSize))
    const safeCurrentPage = Math.min(currentPage, totalPages)

    const paginationStart =
        filteredWorkflows.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize

    const paginationEnd = Math.min(safeCurrentPage * pageSize, filteredWorkflows.length)

    const paginatedWorkflows = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize
        const end = start + pageSize

        return filteredWorkflows.slice(start, end)
    }, [filteredWorkflows, safeCurrentPage, pageSize])

    const clearFilters = () => {
        setSearchQuery('')
        setStatusFilter('all')
        setTypeFilter('all')
        setStageFilter('all')
        setProjectFilter('all')
        setSortOption('updated-desc')
        setCurrentPage(1)
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
                        Showing {filteredWorkflows.length} of {projectScopedWorkflows.length} workflows
                        {projectFilter !== 'all' &&
                            ` · Project: ${projectFilter === 'uncategorized'
                                ? 'Uncategorized'
                                : projectFilter
                            }`}
                        {typeFilter !== 'all' && ` · Type: ${typeFilter}`}
                        {stageFilter !== 'all' && ` · Stage: ${stageFilter}`}
                        {lastRefreshed &&
                            ` · Last refreshed ${lastRefreshed.toLocaleTimeString('en-US', {
                                timeZone: 'America/Chicago',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true,
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

            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <select
                        value={projectFilter}
                        onChange={e => {
                            setProjectFilter(e.target.value as ProjectFilter)
                            setStatusFilter('all')
                            setTypeFilter('all')
                            setStageFilter('all')
                            setCurrentPage(1)
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-gray-500 dark:focus:ring-gray-800"
                    >
                        <option value="all">Project: All</option>

                        {allProjects.map(project => (
                            <option key={project} value={project}>
                                Project: {project}
                            </option>
                        ))}

                        <option value="uncategorized">Project: Uncategorized</option>
                    </select>

                    {(searchQuery ||
                        statusFilter !== 'all' ||
                        typeFilter !== 'all' ||
                        stageFilter !== 'all' ||
                        projectFilter !== 'all' ||
                        sortOption !== 'updated-desc') && (
                            <button
                                onClick={clearFilters}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                Reset view
                            </button>
                        )}
                </div>

                <p className="text-sm text-gray-400 dark:text-gray-500">
                    Summary cards reflect the selected project scope.
                </p>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <MetricCard
                    label="Total"
                    value={operationalCounts.total}
                    active={statusFilter === 'all'}
                    onClick={() => setStatusFilter('all')}
                    colorClass="text-gray-900 dark:text-gray-100"
                />

                <MetricCard
                    label="Active"
                    value={operationalCounts.active}
                    active={statusFilter === 'active'}
                    onClick={() => setStatusFilter('active')}
                    colorClass="text-green-600 dark:text-green-400"
                />

                <MetricCard
                    label="Disabled"
                    value={operationalCounts.disabled}
                    active={statusFilter === 'inactive'}
                    onClick={() => setStatusFilter('inactive')}
                    colorClass="text-gray-400 dark:text-gray-500"
                />

                <MetricCard
                    label="Archived"
                    value={operationalCounts.archived}
                    active={statusFilter === 'archived'}
                    onClick={() => setStatusFilter('archived')}
                    colorClass="text-orange-500 dark:text-orange-400"
                />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                Automation Type
                            </h3>
                            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                                Based on Workflow / AI Agent tags.
                            </p>
                        </div>

                        {typeFilter !== 'all' && (
                            <button
                                onClick={() => setTypeFilter('all')}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                Clear type
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <CompactMetricCard
                            label="Workflow"
                            value={typeCounts.workflow}
                            active={typeFilter === 'Workflow'}
                            onClick={() =>
                                setTypeFilter(typeFilter === 'Workflow' ? 'all' : 'Workflow')
                            }
                            badgeClass="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        />

                        <CompactMetricCard
                            label="AI Agent"
                            value={typeCounts.aiAgent}
                            active={typeFilter === 'AI Agent'}
                            onClick={() =>
                                setTypeFilter(typeFilter === 'AI Agent' ? 'all' : 'AI Agent')
                            }
                            badgeClass="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        />
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                Lifecycle Stage
                            </h3>
                            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                                Based on Production / Development / Paused/Retired / Ad hoc tags.
                            </p>
                        </div>

                        {stageFilter !== 'all' && (
                            <button
                                onClick={() => setStageFilter('all')}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                                Clear stage
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <CompactMetricCard
                            label="Production"
                            value={stageCounts.production}
                            active={stageFilter === 'Production'}
                            onClick={() =>
                                setStageFilter(stageFilter === 'Production' ? 'all' : 'Production')
                            }
                            badgeClass="bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                        />

                        <CompactMetricCard
                            label="Development"
                            value={stageCounts.development}
                            active={stageFilter === 'Development'}
                            onClick={() =>
                                setStageFilter(stageFilter === 'Development' ? 'all' : 'Development')
                            }
                            badgeClass="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                        />

                        <CompactMetricCard
                            label="Paused/Retired"
                            value={stageCounts.pausedRetired}
                            active={stageFilter === 'Paused/Retired'}
                            onClick={() =>
                                setStageFilter(
                                    stageFilter === 'Paused/Retired'
                                        ? 'all'
                                        : 'Paused/Retired'
                                )
                            }
                            badgeClass="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        />

                        <CompactMetricCard
                            label="Ad hoc"
                            value={stageCounts.adHoc}
                            active={stageFilter === 'Ad hoc'}
                            onClick={() =>
                                setStageFilter(stageFilter === 'Ad hoc' ? 'all' : 'Ad hoc')
                            }
                            badgeClass="bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                        />
                    </div>
                </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-xl">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by workflow name, ID, tag, project, author, or description..."
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
                        <option value="inactive-first">Sort: Disabled first</option>
                        <option value="archived-first">Sort: Archived first</option>
                    </select>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/80">
                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Workflow
                                </th>

                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Status
                                </th>

                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Created
                                </th>

                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Last Updated
                                </th>

                                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Manage
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {paginatedWorkflows.map(workflow => {
                                const workflowUrl = getN8nWorkflowUrl(workflow.id)
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
                                                    {workflow.active ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>

                                            <td className="p-4 text-xs text-gray-400 dark:text-gray-500">
                                                {formatDate(workflow.createdAt)}
                                            </td>

                                            <td className="p-4 text-xs text-gray-400 dark:text-gray-500">
                                                {formatDate(workflow.updatedAt)}
                                            </td>

                                            <td className="p-4">
                                                <div className="flex min-w-[260px] flex-col gap-2">
                                                    <div className="inline-flex w-fit overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
                                                        {workflowUrl && (
                                                            <a
                                                                href={workflowUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="border-r border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                                                            >
                                                                Open ↗
                                                            </a>
                                                        )}

                                                        <button
                                                            onClick={() => loadVersionDetails(workflow)}
                                                            disabled={versionLoadingId === workflow.id}
                                                            className={`px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${isExpanded
                                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                                                                }`}
                                                        >
                                                            {versionLoadingId === workflow.id
                                                                ? 'Loading...'
                                                                : isExpanded
                                                                    ? 'Hide Details'
                                                                    : 'Details'}
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button
                                                            onClick={() =>
                                                                toggleWorkflow(workflow.id, workflow.active)
                                                            }
                                                            disabled={actionLoading === workflow.id}
                                                            className={`inline-flex min-w-[92px] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${workflow.active
                                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/60'
                                                                : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'
                                                                }`}
                                                        >
                                                            {actionLoading === workflow.id
                                                                ? 'Updating...'
                                                                : workflow.active
                                                                    ? 'Deactivate'
                                                                    : 'Activate'}
                                                        </button>

                                                        {confirmDelete === workflow.id ? (
                                                            <div className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 dark:border-red-900 dark:bg-red-950/30">
                                                                <span className="text-xs font-medium text-red-600 dark:text-red-300">
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
                                                                    No
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setConfirmDelete(workflow.id)}
                                                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
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
                                                    colSpan={5}
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
                                        colSpan={5}
                                        className="p-8 text-center text-sm text-gray-400 dark:text-gray-500"
                                    >
                                        No workflows found for this search or filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredWorkflows.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            Showing {paginationStart + 1}–{paginationEnd} of{' '}
                            {filteredWorkflows.length} workflows
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={pageSize}
                                onChange={e => {
                                    setPageSize(Number(e.target.value))
                                    setCurrentPage(1)
                                }}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-gray-500 dark:focus:ring-gray-800"
                            >
                                {PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size}>
                                        {size} rows
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={() =>
                                    setCurrentPage(page => Math.max(1, page - 1))
                                }
                                disabled={safeCurrentPage === 1}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Previous
                            </button>

                            <span className="px-2 text-sm text-gray-500 dark:text-gray-400">
                                Page {safeCurrentPage} of {totalPages}
                            </span>

                            <button
                                onClick={() =>
                                    setCurrentPage(page => Math.min(totalPages, page + 1))
                                }
                                disabled={safeCurrentPage === totalPages}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}