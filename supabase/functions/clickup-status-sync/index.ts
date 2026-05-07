// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

console.log("Hello from Functions!")

Deno.serve(async (req) => {
  const { name } = await req.json()
  const data = {
    message: `Hello ${name}!`,
  }

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/clickup-status-sync' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const CLICKUP_WEBHOOK_SECRET = Deno.env.get("CLICKUP_WEBHOOK_SECRET")

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

const RESOLVED_STATUSES = ["released", "done"]

function normalizeClickUpStatus(status: string | null | undefined) {
  if (!status) return null

  return status
    .trim()
    .toLowerCase()
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\s+/g, "_")
}

function extractStatus(payload: any) {
  const historyItems = Array.isArray(payload.history_items)
    ? payload.history_items
    : []

  for (const item of historyItems) {
    if (item.field && item.field !== "status") {
      continue
    }

    const after = item.after

    if (typeof after === "string") {
      return after
    }

    if (typeof after?.status === "string") {
      return after.status
    }

    if (typeof after?.status?.status === "string") {
      return after.status.status
    }

    if (typeof after?.name === "string") {
      return after.name
    }
  }

  if (typeof payload.status === "string") {
    return payload.status
  }

  if (typeof payload.status?.status === "string") {
    return payload.status.status
  }

  return null
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
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
          { error: "Unauthorized webhook request" },
          { status: 401 },
        )
      }
    }

    const payload = await req.json()

    const event = payload.event ?? null
    const taskId = payload.task_id || payload.task?.id || payload.id
    const rawStatus = extractStatus(payload)
    const normalizedStatus = normalizeClickUpStatus(rawStatus)

    if (!taskId) {
      return Response.json(
        {
          ok: false,
          error: "No ClickUp task ID found",
          event,
        },
        { status: 400 },
      )
    }

    if (!normalizedStatus || !VALID_STATUSES.includes(normalizedStatus)) {
      return Response.json(
        {
          ok: true,
          skipped: true,
          reason: "Unsupported or missing ClickUp status",
          event,
          taskId,
          rawStatus,
          normalizedStatus,
        },
        { status: 200 },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
      .select("execution_id, clickup_task_id, status, clickup_task_status, resolved_at, resolved_by")
      .maybeSingle()

    if (error) {
      return Response.json(
        {
          ok: false,
          error: "Failed to update bug log",
          detail: error.message,
          taskId,
          rawStatus,
          normalizedStatus,
        },
        { status: 500 },
      )
    }

    if (!data) {
      return Response.json(
        {
          ok: true,
          updated: null,
          warning: "No matching bug log found for ClickUp task ID",
          taskId,
          rawStatus,
          normalizedStatus,
        },
        { status: 200 },
      )
    }

    return Response.json({
      ok: true,
      event,
      taskId,
      rawStatus,
      normalizedStatus,
      updated: data,
    })
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