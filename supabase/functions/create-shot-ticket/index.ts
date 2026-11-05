// Edge Function: create-shot-ticket
// Creates a Task in Jira project SHOT for a lesson screenshot that needs replacing, sets the
// Learning Content (Assets) field to the lesson's AlCat object and attaches the new capture.
// The capture is passed in the request and sent straight to Jira; it is never stored in Supabase.
//
// POST multipart/form-data:
//   asset_id        required  Orange Logic asset ID of the lesson image (screenshot_recipes.asset_id)
//   screenshot      required  PNG file (the new capture)
//   verdict         required  material | steps_broken
//   changes         required  what changed in the UI, plain text (one change per line)
//   check_results   optional  JSON array [{check, result, detail}]
//   dry_run         optional  "true": validate everything and return the payload, create nothing
// Auth: service role key as Bearer, or a one-time token from public.mint_shot_ticket_token()
// in the x-shot-token header (any valid project key as Bearer).
// Secrets: ATLASSIAN_API_TOKEN, ATLASSIAN_EMAIL (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are built in).

import { createClient } from "npm:@supabase/supabase-js@2";

const JIRA = "https://atlassiantraining.atlassian.net";
const PROJECT = "SHOT";
const ISSUE_TYPE = "Task";
const LEARNING_CONTENT = "customfield_13178";
const WORKSPACE_ID = "5f82c31c-7c7d-440b-887a-530eb23c1930";
const ASSETS = `https://api.atlassian.com/jsm/assets/workspace/${WORKSPACE_ID}/v1`;
const VERDICTS = ["material", "steps_broken"];

type Check = { check: string; result: string; detail: string };

const jwtRole = (t: string) => {
  try {
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null;
  } catch {
    return null;
  }
};

// Atlassian Document Format helpers
const text = (t: string, marks?: unknown[]) => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const link = (t: string, href: string) => text(t, [{ type: "link", attrs: { href } }]);
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const heading = (t: string) => ({ type: "heading", attrs: { level: 3 }, content: [text(t)] });
const bullets = (items: unknown[][]) => ({
  type: "bulletList",
  content: items.map((c) => ({ type: "listItem", content: [para(...c)] })),
});

Deno.serve(async (req) => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only the service role or a fresh one-time token may create tickets
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (bearer !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") && jwtRole(bearer) !== "service_role") {
      const { data } = await db
        .from("shot_ticket_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", req.headers.get("x-shot-token") ?? "")
        .is("used_at", null)
        .gt("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
        .select("token");
      if (!data?.length) return Response.json({ error: "Not authorized" }, { status: 401 });
    }

    const apiToken = Deno.env.get("ATLASSIAN_API_TOKEN");
    const email = Deno.env.get("ATLASSIAN_EMAIL");
    if (!apiToken || !email) throw new Error("Missing ATLASSIAN_API_TOKEN or ATLASSIAN_EMAIL");
    const auth = "Basic " + btoa(`${email}:${apiToken}`);
    const jira = async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${JIRA}${path}`, {
        ...init,
        headers: { Authorization: auth, Accept: "application/json", ...(init.headers ?? {}) },
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`Jira ${init.method ?? "GET"} ${path.split("?")[0]} ${res.status}: ${body.slice(0, 400)}`);
      return body ? JSON.parse(body) : null;
    };

    // Input
    const form = await req.formData();
    const assetId = String(form.get("asset_id") ?? "");
    const verdict = String(form.get("verdict") ?? "");
    const changes = String(form.get("changes") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    const checks: Check[] = JSON.parse(String(form.get("check_results") ?? "[]"));
    const dryRun = form.get("dry_run") === "true";
    const file = form.get("screenshot");
    if (!assetId) return Response.json({ error: "asset_id is required" }, { status: 400 });
    if (!VERDICTS.includes(verdict)) return Response.json({ error: `verdict must be ${VERDICTS.join(" or ")}` }, { status: 400 });
    if (!changes.length) return Response.json({ error: "changes is required" }, { status: 400 });
    if (!(file instanceof File)) return Response.json({ error: "screenshot file is required" }, { status: 400 });
    const png = new Uint8Array(await file.arrayBuffer());
    if (png[0] !== 0x89 || png[1] !== 0x50) return Response.json({ error: "screenshot must be a PNG" }, { status: 400 });

    // Lesson context from Supabase
    const { data: recipe, error: rErr } = await db
      .from("screenshot_recipes")
      .select("id, lesson_id, image_url, notes")
      .eq("asset_id", assetId)
      .single();
    if (rErr || !recipe) return Response.json({ error: `No screenshot_recipes row for asset ${assetId}` }, { status: 404 });
    const [{ data: alcat }, { data: lesson }, { data: shot }] = await Promise.all([
      db.from("alcat_lessons").select("alcat_object_id, alcat_key, web_url").eq("lesson_id", recipe.lesson_id).single(),
      db.from("lessons").select("title").eq("id", recipe.lesson_id).single(),
      db.from("lesson_screenshots").select("position, section").eq("lesson_id", recipe.lesson_id).eq("asset_id", assetId).maybeSingle(),
    ]);
    if (!alcat) return Response.json({ error: `Lesson ${recipe.lesson_id} is not in alcat_lessons` }, { status: 404 });

    // The Learning Content object must exist in Assets
    const assetRes = await fetch(`${ASSETS}/object/${alcat.alcat_object_id}`, { headers: { Authorization: auth, Accept: "application/json" } });
    if (!assetRes.ok) throw new Error(`Assets object ${alcat.alcat_object_id} ${assetRes.status}: ${(await assetRes.text()).slice(0, 200)}`);
    const assetObj = await assetRes.json();

    // One open ticket per screenshot
    const label = `asset-${assetId}`;
    const open = await jira("/rest/api/3/search/jql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jql: `project = ${PROJECT} AND labels = "${label}" AND statusCategory != Done`, fields: ["summary"], maxResults: 1 }),
    });
    const existing = open?.issues?.[0];
    if (existing) {
      return Response.json({ status: "duplicate", key: existing.key, url: `${JIRA}/browse/${existing.key}` });
    }

    const image = shot ? `image ${shot.position}` : "image";
    const fields = {
      project: { key: PROJECT },
      issuetype: { name: ISSUE_TYPE },
      summary: `${alcat.alcat_key} ${image}: update screenshot (${lesson?.title ?? "lesson"})`.slice(0, 250),
      labels: ["screenshot-runner", label, verdict.replace("_", "-")],
      [LEARNING_CONTENT]: [{ workspaceId: WORKSPACE_ID, id: `${WORKSPACE_ID}:${alcat.alcat_object_id}`, objectId: String(alcat.alcat_object_id) }],
      description: {
        type: "doc",
        version: 1,
        content: [
          para(text("The product UI has changed, so this lesson screenshot needs replacing in Contentful. The new capture is attached.")),
          bullets([
            [text("Lesson: "), link(`${alcat.alcat_key} ${lesson?.title ?? ""}`.trim(), alcat.web_url)],
            [text(`Section: ${shot?.section ?? "unknown"} (${image})`)],
            [text("Current image: "), link(assetId, recipe.image_url)],
            [text(`Verdict: ${verdict}${verdict === "steps_broken" ? " (lesson text needs updating too)" : ""}`)],
          ]),
          heading("What changed"),
          bullets(changes.map((c) => [text(c)])),
          ...(checks.length
            ? [heading("Checks"), bullets(checks.map((c) => [text(`${c.result === "pass" ? "Pass" : "Fail"}: ${c.check}. ${c.detail}`)]))]
            : []),
          para(text(`Recipe ${recipe.id}. Created by the screenshot runner.`)),
        ],
      },
    };

    if (dryRun) {
      const perms = await jira(`/rest/api/3/mypermissions?projectKey=${PROJECT}&permissions=CREATE_ISSUES,CREATE_ATTACHMENTS`);
      return Response.json({
        status: "dry_run",
        learning_content: { objectId: alcat.alcat_object_id, label: assetObj.label, objectKey: assetObj.objectKey },
        permissions: Object.fromEntries(Object.entries(perms.permissions).map(([k, v]) => [k, (v as { havePermission: boolean }).havePermission])),
        screenshot_bytes: png.length,
        fields,
      });
    }

    const created = await jira("/rest/api/3/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    const upload = new FormData();
    upload.append("file", new Blob([png], { type: "image/png" }), `${alcat.alcat_key}-${image.replace(" ", "-")}-new.png`);
    let attached = true;
    let attachError: string | null = null;
    try {
      await jira(`/rest/api/3/issue/${created.key}/attachments`, { method: "POST", headers: { "X-Atlassian-Token": "no-check" }, body: upload });
    } catch (e) {
      attached = false;
      attachError = String(e);
    }

    return Response.json({ status: "created", key: created.key, url: `${JIRA}/browse/${created.key}`, attached, attach_error: attachError });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
