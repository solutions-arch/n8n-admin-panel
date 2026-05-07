import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const CLICKUP_WEBHOOK_SECRET = Deno.env.get("CLICKUP_WEBHOOK_SECRET")
const CLICKUP_API_TOKEN = Deno.env.get("CLICKUP_API_TOKEN")

const VALID_STATUSES = [
  "reported",
  "triage",
  "in_progress",
  "code_review",
  "qa_testing",
  "rejected",
  "released",
  "done",
]

const RESOLVED_STATUSES = ["rejected", "released", "done"]

function normalizeClickUpStatus(status: string | null | undefined) {
  if (!status) return null

  const cleaned = status
    .trim()
    .toLowerCase()
    // remove emojis/symbols but keep letters, numbers, spaces, hyphens, and underscores
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()

  const statusMap: Record<string, string> = {
    reported: "reported",
    triage: "triage",
    "in progress": "in_progress",
    "code review": "code_review",
    "qa testing": "qa_testing",
    rejected: "rejected",
    released: "released",
    done: "done",
  }

  return statusMap[cleaned] ?? cleaned.replace(/\s+/g, "_")
}

function extractTaskId(payload: any) {
  return (
    payload.task_id ||
    payload.task?.id ||
    payload.id ||
    payload.payload?.id ||
    payload.payload?.task_id ||
    payload.payload?.task?.id ||
    null
  )
}

function extractStatusFromValue(value: any) {
  if (!value) return null

  if (typeof value === "string") {
    return value
  }

  if (typeof value.status === "string") {
    return value.status
  }

  if (typeof value.status?.status === "string") {
    return value.status.status
  }

  if (typeof value.name === "string") {
    return value.name
  }

  return null
}

function extractStatus(payload: any) {
  const historyItems = Array.isArray(payload.history_items)
    ? payload.history_items
    : []

  for (const item of historyItems) {
    if (item.field && item.field !== "status") {
      continue
    }

    const fromAfter = extractStatusFromValue(item.after)

    if (fromAfter) {
      return fromAfter
    }
  }

  return (
    extractStatusFromValue(payload.status) ||
    extractStatusFromValue(payload.task?.status) ||
    extractStatusFromValue(payload.payload?.status) ||
    extractStatusFromValue(payload.payload?.task?.status) ||
    null
  )
}

async function fetchClickUpTaskStatus(taskId: string) {
  if (!CLICKUP_API_TOKEN) {
    return {
      rawStatus: null,
      fetchError: "Missing CLICKUP_API_TOKEN",
    }
  }

  const response = await fetch(
    `https://api.clickup.com/api/v2/task/${taskId}`,
    {
      method: "GET",
      headers: {
        Authorization: CLICKUP_API_TOKEN,
        "Content-Type": "application/json",
      },
    },
  )

  const text = await response.text()
  let data: any = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    return {
      rawStatus: null,
      fetchError: `ClickUp task fetch failed: ${response.status}`,
      fetchResponse: data,
    }
  }

  return {
    rawStatus: extractStatusFromValue(data.status),
    fetchError: null,
    fetchResponse: {
      id: data.id,
      name: data.name,
      status: data.status,
      url: data.url,
    },
  }
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
          ok: false,
          error: "Missing Supabase environment variables",
          required: [
            "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
          ],
        },
        { status: 500 },
      )
    }

    if (CLICKUP_WEBHOOK_SECRET) {
      const incomingSecret = req.headers.get("x-clickup-webhook-secret")

      if (incomingSecret !== CLICKUP_WEBHOOK_SECRET) {
        return Response.json(
          {
            ok: false,
            error: "Unauthorized webhook request",
          },
          { status: 401 },
        )
      }
    }

    const payload = await req.json()

    const event = payload.event ?? "automation_call_webhook"
    const taskId = extractTaskId(payload)

    let rawStatus = extractStatus(payload)
    let statusSource = "webhook_payload"
    let clickupFetchDetails: any = null

    if (!rawStatus && taskId) {
      const fetched = await fetchClickUpTaskStatus(taskId)
      rawStatus = fetched.rawStatus
      statusSource = "clickup_api"
      clickupFetchDetails = fetched
    }

    const normalizedStatus = normalizeClickUpStatus(rawStatus)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: debugLog } = await supabase
      .from("clickup_webhook_debug_logs")
      .insert({
        event,
        task_id: taskId,
        raw_status: rawStatus,
        normalized_status: normalizedStatus,
        payload: {
          statusSource,
          clickupFetchDetails,
          originalPayload: payload,
        },
      })
      .select("id")
      .maybeSingle()

    if (!taskId) {
      const result = {
        ok: false,
        error: "No ClickUp task ID found",
        event,
        detectedPayloadShape: {
          hasPayload: Boolean(payload.payload),
          hasTask: Boolean(payload.task),
          hasHistoryItems: Array.isArray(payload.history_items),
        },
      }

      if (debugLog?.id) {
        await supabase
          .from("clickup_webhook_debug_logs")
          .update({ update_result: result })
          .eq("id", debugLog.id)
      }

      return Response.json(result, { status: 400 })
    }

    if (!normalizedStatus || !VALID_STATUSES.includes(normalizedStatus)) {
      const result = {
        ok: true,
        skipped: true,
        reason: "Unsupported or missing ClickUp status",
        event,
        taskId,
        rawStatus,
        normalizedStatus,
        statusSource,
        clickupFetchDetails,
      }

      if (debugLog?.id) {
        await supabase
          .from("clickup_webhook_debug_logs")
          .update({ update_result: result })
          .eq("id", debugLog.id)
      }

      return Response.json(result, { status: 200 })
    }

    const isResolved = RESOLVED_STATUSES.includes(normalizedStatus)

    const updates = {
      status: normalizedStatus,
      clickup_task_status: String(rawStatus || "").toUpperCase(),
      resolved_at: isResolved ? new Date().toISOString() : null,
      resolved_by: isResolved ? "clickup" : null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("workflow_bug_logs")
      .update(updates)
      .eq("clickup_task_id", taskId)
      .select(
        "execution_id, clickup_task_id, status, clickup_task_status, resolved_at, resolved_by",
      )
      .maybeSingle()

    if (error) {
      const result = {
        ok: false,
        error: "Failed to update bug log",
        detail: error.message,
        taskId,
        rawStatus,
        normalizedStatus,
        statusSource,
      }

      if (debugLog?.id) {
        await supabase
          .from("clickup_webhook_debug_logs")
          .update({ update_result: result })
          .eq("id", debugLog.id)
      }

      return Response.json(result, { status: 500 })
    }

    if (!data) {
      const result = {
        ok: true,
        updated: null,
        warning: "No matching bug log found for ClickUp task ID",
        taskId,
        rawStatus,
        normalizedStatus,
        statusSource,
      }

      if (debugLog?.id) {
        await supabase
          .from("clickup_webhook_debug_logs")
          .update({ update_result: result })
          .eq("id", debugLog.id)
      }

      return Response.json(result, { status: 200 })
    }

    const result = {
      ok: true,
      event,
      taskId,
      rawStatus,
      normalizedStatus,
      statusSource,
      updated: data,
    }

    if (debugLog?.id) {
      await supabase
        .from("clickup_webhook_debug_logs")
        .update({ update_result: result })
        .eq("id", debugLog.id)
    }

    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Internal server error",
        detail: String(error),
      },
      { status: 500 },
    )
  }
})