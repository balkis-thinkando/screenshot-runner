// Edge Function: scan-lesson-screenshots
// 1. Reads every Lesson (object type 80) from the AlCat Assets schema.
// 2. Builds each lesson's Web URL from its slug.
// 3. Scans the published page for images (lightweight text scan, no DOM).
// 4. Upserts public.alcat_lessons and replaces public.lesson_screenshots for the lessons scanned.
//
// Runs in batches: POST {"offset": 0, "limit": 50}. The response gives next_offset (null when done).
// Run batches one at a time: parallel batches make the lesson site return pages without content.
// After the last batch, POST {"cleanup": true} removes rows for lessons no longer in Assets or in
// public.lessons (it refuses when the lesson list looks incomplete).
// Called weekly by scripts/scan-inventory.mjs (workflow .github/workflows/screenshot-inventory.yml).
// Secrets: ATLASSIAN_API_TOKEN, ATLASSIAN_EMAIL (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are built in).
// Source of truth: this file in balkis-thinkando/screenshot-runner. Redeploy after changing it.

import { createClient } from "npm:@supabase/supabase-js@2";

const WORKSPACE_ID = "5f82c31c-7c7d-440b-887a-530eb23c1930";
const LESSON_TYPE_ID = 80;
const ATTR = { slug: "696", contentfulId: "699" };
const ASSETS = `https://api.atlassian.com/jsm/assets/workspace/${WORKSPACE_ID}/v1`;
const LESSON_BASE = "https://community.atlassian.com/learning/lesson/";
const CONCURRENCY = 6;
const CLEANUP_MIN_SHARE = 0.8; // cleanup refuses if the lesson list shrank below 80% of the stored lessons

type AssetsObject = {
  id: string;
  objectKey: string;
  attributes: { objectTypeAttributeId: string; objectAttributeValues: { value?: string; displayValue?: string }[] }[];
};

const attr = (o: AssetsObject, id: string) => {
  const v = o.attributes.find((a) => a.objectTypeAttributeId === id)?.objectAttributeValues?.[0];
  return v?.value ?? v?.displayValue ?? null;
};

async function fetchLessons(auth: string): Promise<AssetsObject[]> {
  const all: AssetsObject[] = [];
  for (let startAt = 0; ; startAt += 100) {
    const res = await fetch(`${ASSETS}/object/aql?startAt=${startAt}&maxResults=100&includeAttributes=true`, {
      method: "POST",
      headers: { Authorization: auth, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ qlQuery: `objectTypeId = ${LESSON_TYPE_ID}` }),
    });
    if (!res.ok) throw new Error(`Assets AQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const page = await res.json();
    all.push(...(page.values ?? []));
    if (page.isLast || !page.values?.length) break;
  }
  return all;
}

const decode = (s: string) =>
  s.replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

function getAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[1] ?? m[2] ?? "") : null;
}

// Walks headings and images in page order; each image takes the last heading seen.
async function scanPage(lessonId: string, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let html = await res.text();
  const a = html.search(/<main\b/i);
  const b = html.search(/<\/main>/i);
  if (a >= 0 && b > a) html = html.slice(a, b);

  const shots: Record<string, unknown>[] = [];
  let heading: string | null = null;
  let position = 0;
  const re = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1]) {
      heading = decode(m[2]) || heading;
      continue;
    }
    const tag = m[0];
    const src = getAttr(tag, "src") || getAttr(tag, "data-src") || "";
    if (!/dam-cdn|ctfassets/.test(src)) continue;
    position++;
    const seg = new URL(src).pathname.split("/").pop() ?? "";
    shots.push({
      lesson_id: lessonId,
      position,
      section: heading?.slice(0, 200) ?? null,
      asset_id: seg.replace(/\.[a-z]+$/i, "") || null,
      file_type: seg.match(/\.([a-z]+)$/i)?.[1]?.toLowerCase() ?? null,
      image_url: src,
      alt: getAttr(tag, "alt"),
    });
  }
  return shots;
}

type Db = ReturnType<typeof createClient>;

async function storedLessonIds(db: Db, table: string): Promise<string[]> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("lesson_id").range(from, from + 999);
    if (error) throw error;
    (data ?? []).forEach((r) => ids.add(r.lesson_id as string));
    if (!data || data.length < 1000) break;
  }
  return [...ids];
}

// Removes rows for lessons that are no longer in Assets or no longer in public.lessons.
async function cleanup(db: Db, keep: Set<string>) {
  const stored = await storedLessonIds(db, "alcat_lessons");
  if (keep.size < stored.length * CLEANUP_MIN_SHARE) {
    throw new Error(`Cleanup refused: ${keep.size} lessons found but ${stored.length} stored (below ${CLEANUP_MIN_SHARE * 100}%)`);
  }
  const goneLessons = stored.filter((id) => !keep.has(id));
  const goneShotLessons = (await storedLessonIds(db, "lesson_screenshots")).filter((id) => !keep.has(id));
  let removedScreenshots = 0;
  for (let i = 0; i < goneShotLessons.length; i += 100) {
    const { error, count } = await db.from("lesson_screenshots").delete({ count: "exact" })
      .in("lesson_id", goneShotLessons.slice(i, i + 100));
    if (error) throw error;
    removedScreenshots += count ?? 0;
  }
  for (let i = 0; i < goneLessons.length; i += 100) {
    const { error } = await db.from("alcat_lessons").delete().in("lesson_id", goneLessons.slice(i, i + 100));
    if (error) throw error;
  }
  return { removed_lessons: goneLessons.length, removed_screenshots: removedScreenshots };
}

Deno.serve(async (req) => {
  try {
    const token = Deno.env.get("ATLASSIAN_API_TOKEN");
    const email = Deno.env.get("ATLASSIAN_EMAIL");
    if (!token || !email) return new Response("Missing ATLASSIAN_API_TOKEN or ATLASSIAN_EMAIL", { status: 500 });
    const auth = "Basic " + btoa(`${email}:${token}`);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    if (body.debug_url) {
      const r = await fetch(body.debug_url);
      const html = await r.text();
      const shots = await scanPage("debug", body.debug_url);
      return Response.json({
        status: r.status,
        final_url: r.url,
        length: html.length,
        dam_refs: (html.match(/dam-cdn/g) ?? []).length,
        main_open: html.search(/<main\b/i),
        main_close: html.search(/<\/main>/i),
        head: html.slice(0, 300),
        shots,
      });
    }
    const offset = Number(body.offset ?? 0);
    const limit = Number(body.limit ?? 50);

    const objects = await fetchLessons(auth);

    // Only lessons that exist in public.lessons (keyed by Contentful ID)
    const knownIds = new Set(await (async () => {
      const ids: string[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from("lessons").select("id").range(from, from + 999);
        if (error) throw error;
        ids.push(...(data ?? []).map((r) => r.id as string));
        if (!data || data.length < 1000) break;
      }
      return ids;
    })());

    const lessons = objects
      .map((o) => ({
        lesson_id: attr(o, ATTR.contentfulId),
        alcat_object_id: Number(o.id),
        alcat_key: o.objectKey,
        slug: attr(o, ATTR.slug),
      }))
      .filter((l) => l.lesson_id && l.slug && knownIds.has(l.lesson_id))
      .sort((x, y) => x.alcat_object_id - y.alcat_object_id);
    const skipped = objects.length - lessons.length;

    if (body.cleanup) {
      const result = await cleanup(db, new Set(lessons.map((l) => l.lesson_id!)));
      return Response.json({ assets_lessons: objects.length, total: lessons.length, ...result });
    }

    const batch = lessons.slice(offset, offset + limit);

    const allShots: Record<string, unknown>[] = [];
    const counts = new Map<string, number>();
    const failures: { key: string; error: string }[] = [];
    const queue = [...batch];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      for (let l = queue.shift(); l; l = queue.shift()) {
        try {
          const shots = await scanPage(l.lesson_id!, LESSON_BASE + l.slug);
          counts.set(l.lesson_id!, shots.length);
          allShots.push(...shots);
        } catch (e) {
          failures.push({ key: l.alcat_key, error: String(e) });
        }
      }
    }));

    const now = new Date().toISOString();
    const lessonRows = batch.filter((l) => counts.has(l.lesson_id!)).map((l) => ({
      lesson_id: l.lesson_id,
      alcat_object_id: l.alcat_object_id,
      alcat_key: l.alcat_key,
      slug: l.slug,
      web_url: LESSON_BASE + l.slug,
      image_count: counts.get(l.lesson_id!) ?? 0,
      scanned_at: now,
    }));
    if (lessonRows.length) {
      const { error } = await db.from("alcat_lessons").upsert(lessonRows, { onConflict: "lesson_id" });
      if (error) throw error;
    }

    // Replace screenshots only for lessons scanned successfully
    const scanned = [...counts.keys()];
    if (scanned.length) {
      const { error } = await db.from("lesson_screenshots").delete().in("lesson_id", scanned);
      if (error) throw error;
    }
    if (allShots.length) {
      const { error } = await db.from("lesson_screenshots").insert(allShots.map((s) => ({ ...s, scanned_at: now })));
      if (error) throw error;
    }

    return Response.json({
      assets_lessons: objects.length,
      skipped_not_in_lessons_table: skipped,
      total: lessons.length,
      offset,
      next_offset: offset + limit < lessons.length ? offset + limit : null,
      pages_scanned: scanned.length,
      screenshots: allShots.length,
      failures,
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
