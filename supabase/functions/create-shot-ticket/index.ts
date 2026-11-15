// Edge Function: create-shot-ticket
// Creates a Task in Jira project SHOT for a lesson screenshot that needs replacing, sets the
// Learning Content (Assets) field to the lesson's AlCat object and attaches the new capture.
// The capture is passed in the request and sent straight to Jira; it is never stored in Supabase.
//
// POST multipart/form-data:
//   asset_id        required  Orange Logic asset ID of the lesson image (screenshot_recipes.asset_id)
//   verdict         required  material | steps_broken
//   changes         required  UI changes vs the lesson image, plain text, one per line (include any
//                             lesson text or labelled graphic that needs updating too)
//   screenshot      required  PNG file (the new capture), except with issue_key
//   comparison      optional  PNG: side-by-side of the current lesson image and the new capture, attached too
//   issue_key       optional  rewrite the description of this existing ticket instead of creating one
//   attach_only     optional  "true" with issue_key: only add the image(s) to that ticket
//   ai_reviewed     optional  "true": the verdict came from the AI review; adds the ai-reviewed label
//   ai_repaired     optional  "true": the script was repaired by AI to reach the screen; adds the ai-repaired label
//   steps_changed   optional  how the path to the screen changed (plain text); adds a line before "What changed"
//   dry_run         optional  "true": validate everything and return the payload, change nothing
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

const jwtRole = (t: string) => {
  try {
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null;
  } catch {
    return null;
  }
};

// Atlassian Document Format helpers
const text = (t: string, marks?: unknown[]) => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const heading = (t: string) => ({ type: "heading", attrs: { level: 3 }, content: [text(t)] });
const link = (t: string, href: string) => text(t, [{ type: "link", attrs: { href } }]);
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const bullets = (items: unknown[][]) => ({
  type: "bulletList",
  content: items.map((c) => ({ type: "listItem", content: [para(...c)] })),
});

Deno.serve(async (req) => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Only the service role or a fresh one-time token may call this
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
    const issueKey = String(form.get("issue_key") ?? "").trim();
    const dryRun = form.get("dry_run") === "true";
    const aiReviewed = form.get("ai_reviewed") === "true";
    const aiRepaired = form.get("ai_repaired") === "true";
    const stepsChanged = String(form.get("steps_changed") ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    const attachOnly = form.get("attach_only") === "true";
    const file = form.get("screenshot");
    const comparisonFile = form.get("comparison");
    if (!assetId) return Response.json({ error: "asset_id is required" }, { status: 400 });
    if (!attachOnly && !VERDICTS.includes(verdict)) return Response.json({ error: `verdict must be ${VERDICTS.join(" or ")}` }, { status: 400 });
    if (!attachOnly && !changes.length) return Response.json({ error: "changes is required" }, { status: 400 });
    let png: Uint8Array | null = null;
    if (file instanceof File) {
      png = new Uint8Array(await file.arrayBuffer());
      if (png[0] !== 0x89 || png[1] !== 0x50) return Response.json({ error: "screenshot must be a PNG" }, { status: 400 });
    } else if (!issueKey || attachOnly) {
      return Response.json({ error: "screenshot file is required" }, { status: 400 });
    }
    let comparison: Uint8Array | null = null;
    if (comparisonFile instanceof File) {
      comparison = new Uint8Array(await comparisonFile.arrayBuffer());
      if (comparison[0] !== 0x89 || comparison[1] !== 0x50) return Response.json({ error: "comparison must be a PNG" }, { status: 400 });
    }

    // Lesson context from Supabase
    const { data: recipe, error: rErr } = await db
      .from("screenshot_recipes")
      .select("id, lesson_id, image_url")
      .eq("asset_id", assetId)
      .single();
    if (rErr || !recipe) return Response.json({ error: `No screenshot_recipes row for asset ${assetId}` }, { status: 404 });
    const [{ data: alcat }, { data: lesson }, { data: shot }] = await Promise.all([
      db.from("alcat_lessons").select("alcat_object_id, alcat_key, web_url").eq("lesson_id", recipe.lesson_id).single(),
      db.from("lessons").select("title").eq("id", recipe.lesson_id).single(),
      db.from("lesson_screenshots").select("position, section").eq("lesson_id", recipe.lesson_id).eq("asset_id", assetId).maybeSingle(),
    ]);
    if (!alcat) return Response.json({ error: `Lesson ${recipe.lesson_id} is not in alcat_lessons` }, { status: 404 });

    const label = `asset-${assetId}`;
    const image = shot ? `image ${shot.position}` : "image";

    // Description template agreed with the owner (5 Nov 2026)
    const description = {
      type: "doc",
      version: 1,
      content: [
        para(text("The product UI has changed, so this lesson screenshot needs replacing in Contentful. The new capture is attached.")),
        para(text("Lesson URL: "), link(alcat.web_url, alcat.web_url)),
        ...(stepsChanged ? [para(text(`The steps to reach this screen have changed: ${stepsChanged}`))] : []),
        heading("What changed"),
        bullets(changes.map((c) => [text(c)])),
      ],
    };

    // Attach the new capture (and the side-by-side, when given) to a ticket
    const attach = async (key: string) => {
      const upload = new FormData();
      upload.append("file", new Blob([png!], { type: "image/png" }), `${alcat.alcat_key}-${image.replace(" ", "-")}-new.png`);
      if (comparison) upload.append("file", new Blob([comparison], { type: "image/png" }), `${alcat.alcat_key}-${image.replace(" ", "-")}-comparison.png`);
      await jira(`/rest/api/3/issue/${key}/attachments`, { method: "POST", headers: { "X-Atlassian-Token": "no-check" }, body: upload });
    };

    // Existing ticket for this screenshot: rewrite its description, or only add images
    if (issueKey) {
      const issue = await jira(`/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=labels`);
      if (!issue.fields.labels?.includes(label)) {
        return Response.json({ error: `${issueKey} is not the ticket for asset ${assetId}` }, { status: 409 });
      }
      if (attachOnly) {
        if (dryRun) return Response.json({ status: "dry_run", key: issueKey, files: comparison ? 2 : 1 });
        await attach(issueKey);
        return Response.json({ status: "attached", key: issueKey, url: `${JIRA}/browse/${issueKey}`, files: comparison ? 2 : 1 });
      }
      if (dryRun) return Response.json({ status: "dry_run", key: issueKey, description });
      await jira(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { description } }),
      });
      return Response.json({ status: "updated", key: issueKey, url: `${JIRA}/browse/${issueKey}` });
    }

    // The Learning Content object must exist in Assets
    const assetRes = await fetch(`${ASSETS}/object/${alcat.alcat_object_id}`, { headers: { Authorization: auth, Accept: "application/json" } });
    if (!assetRes.ok) throw new Error(`Assets object ${alcat.alcat_object_id} ${assetRes.status}: ${(await assetRes.text()).slice(0, 200)}`);
    const assetObj = await assetRes.json();

    // One open ticket per screenshot
    const open = await jira("/rest/api/3/search/jql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jql: `project = ${PROJECT} AND labels = "${label}" AND statusCategory != Done`, fields: ["summary"], maxResults: 1 }),
    });
    const existing = open?.issues?.[0];
    if (existing) {
      return Response.json({ status: "duplicate", key: existing.key, url: `${JIRA}/browse/${existing.key}` });
    }

    const fields = {
      project: { key: PROJECT },
      issuetype: { name: ISSUE_TYPE },
      summary: `${alcat.alcat_key} ${image}: update screenshot (${lesson?.title ?? "lesson"})`.slice(0, 250),
      labels: ["screenshot-runner", label, verdict.replace("_", "-"), ...(aiReviewed ? ["ai-reviewed"] : []), ...(aiRepaired ? ["ai-repaired"] : [])],
      [LEARNING_CONTENT]: [{ workspaceId: WORKSPACE_ID, id: `${WORKSPACE_ID}:${alcat.alcat_object_id}`, objectId: String(alcat.alcat_object_id) }],
      description,
    };

    if (dryRun) {
      const perms = await jira(`/rest/api/3/mypermissions?projectKey=${PROJECT}&permissions=CREATE_ISSUES,CREATE_ATTACHMENTS`);
      return Response.json({
        status: "dry_run",
        learning_content: { objectId: alcat.alcat_object_id, label: assetObj.label, objectKey: assetObj.objectKey },
        permissions: Object.fromEntries(Object.entries(perms.permissions).map(([k, v]) => [k, (v as { havePermission: boolean }).havePermission])),
        screenshot_bytes: png!.length,
        fields,
      });
    }

    const created = await jira("/rest/api/3/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    let attached = true;
    let attachError: string | null = null;
    try {
      await attach(created.key);
    } catch (e) {
      attached = false;
      attachError = String(e);
    }

    return Response.json({ status: "created", key: created.key, url: `${JIRA}/browse/${created.key}`, attached, attach_error: attachError });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
