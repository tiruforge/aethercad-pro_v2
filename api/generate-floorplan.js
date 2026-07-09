// api/generate-floorplan.js
// Single model: nvidia/nemotron-3-ultra-550b-a55b:free
// Edge runtime = up to ~30s (needed for this large free model)

export const config = {
  runtime: "edge",
};

// ---------- helpers (your proven logic) ----------
function extractPlotSize(prompt) {
  const m = prompt.match(
    /(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?/i
  );
  if (!m) return null;

  const w = Number(m[1]);
  const h = Number(m[3]);
  let unit = (m[2] || m[4] || "").toLowerCase();

  if (unit === "'" || unit === "ft" || unit === "feet") unit = "ft";
  else if (unit === "m" || unit === "meter" || unit === "meters") unit = "m";
  else if (unit === "cm") unit = "cm";
  else unit = "ft";

  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { units: unit, outerWidth: w, outerHeight: h };
}

function extractRequirements(prompt) {
  const p = String(prompt || "").toLowerCase();

  const bhkMatch = p.match(/(\d+)\s*bhk/);
  const bhk = bhkMatch ? Number(bhkMatch[1]) : null;

  const bathMatch = p.match(/(\d+)\s*(bath|bathroom|toilet|washroom)s?/);
  const bathrooms = bathMatch ? Number(bathMatch[1]) : null;

  const wantsParking = /(parking|car\s*park|carpark)/.test(p);
  const wantsBalcony = /(balcony|utility|garden|courtyard|sitout)/.test(p);

  return { bhk, bathrooms, wantsParking, wantsBalcony };
}

function defaultPlotForBHK(bhk) {
  if (bhk === 1) return { units: "ft", outerWidth: 20, outerHeight: 30 };
  if (bhk === 2) return { units: "ft", outerWidth: 30, outerHeight: 40 };
  if (bhk === 3) return { units: "ft", outerWidth: 40, outerHeight: 40 };
  if (bhk >= 4) return { units: "ft", outerWidth: 50, outerHeight: 60 };
  return { units: "ft", outerWidth: 30, outerHeight: 40 };
}

// Snap numbers so walls/rooms/labels align (fixes messy measurement drift)
function snapGeometryToCleanGrid(plan, finalDims) {
  if (!plan) return plan;

  plan.meta = plan.meta || {};
  plan.meta.units = finalDims.units;
  plan.meta.outerWidth = finalDims.outerWidth;
  plan.meta.outerHeight = finalDims.outerHeight;

  const ow = finalDims.outerWidth;
  const oh = finalDims.outerHeight;
  const snap = (v) =>
    v !== undefined && v !== null && Number.isFinite(Number(v))
      ? Math.round(Number(v))
      : 0;

  if (Array.isArray(plan.walls)) {
    plan.walls.forEach((wall) => {
      wall.x1 = Math.min(ow, Math.max(0, snap(wall.x1)));
      wall.y1 = Math.min(oh, Math.max(0, snap(wall.y1)));
      wall.x2 = Math.min(ow, Math.max(0, snap(wall.x2)));
      wall.y2 = Math.min(oh, Math.max(0, snap(wall.y2)));
      if (wall.thickness !== undefined) {
        wall.thickness = Math.max(1, snap(wall.thickness));
      }
    });
  }

  if (Array.isArray(plan.rooms)) {
    plan.rooms.forEach((room) => {
      room.x = Math.min(ow, Math.max(0, snap(room.x)));
      room.y = Math.min(oh, Math.max(0, snap(room.y)));
      room.width = Math.min(ow - room.x, Math.max(2, snap(room.width)));
      room.height = Math.min(oh - room.y, Math.max(2, snap(room.height)));
    });
  }

  // Keep wallIndex schema; only snap position/width numbers
  if (Array.isArray(plan.doors)) {
    plan.doors.forEach((door) => {
      if (door.position !== undefined) door.position = snap(door.position);
      if (door.width !== undefined) door.width = Math.max(1, snap(door.width));
    });
  }

  if (Array.isArray(plan.windows)) {
    plan.windows.forEach((win) => {
      if (win.position !== undefined) win.position = snap(win.position);
      if (win.width !== undefined) win.width = Math.max(1, snap(win.width));
    });
  }

  return plan;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterSeconds(rawText, fallback = 8) {
  try {
    const data = JSON.parse(rawText);
    const sec =
      data?.error?.metadata?.retry_after_seconds ??
      data?.error?.metadata?.retry_after_seconds_raw;
    if (typeof sec === "number" && sec > 0) return Math.min(15, Math.ceil(sec));
  } catch (_) {}
  return fallback;
}

// ---------- ONLY THIS MODEL ----------
const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

export default async function handler(req) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
    "Access-Control-Allow-Headers":
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed. Use POST." }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { prompt } = body || {};
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY missing on Vercel" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const dims = extractPlotSize(prompt);
    const reqs = extractRequirements(prompt);
    const finalDims = dims || defaultPlotForBHK(reqs.bhk);

    const systemPrompt = `
You are a CAD floorplan generator.

Return ONLY valid JSON (no markdown, no explanation, no extra text).

Rules about dimensions:
- If plot size is provided (e.g., 30ft x 40ft), you MUST match it exactly.
- If plot size is not provided, choose a reasonable plot size and include it in meta.

Rules about bathrooms:
- If user specifies bathrooms count, include exactly that many bathrooms.
- If user does NOT specify bathrooms, include at least 1 bathroom.

Rules about gaps (parking/balcony/utility):
- ONLY reserve empty space/gap if the user asks for it (parking/balcony/utility/garden).
- If user does NOT ask, use the plot efficiently (no large unused areas).

JSON Schema:
{
  "meta": {
    "units": "ft|m|cm",
    "outerWidth": number,
    "outerHeight": number
  },
  "walls": [
    { "x1": number, "y1": number, "x2": number, "y2": number, "thickness": number }
  ],
  "doors": [
    { "wallIndex": number, "position": number, "width": number }
  ],
  "windows": [
    { "wallIndex": number, "position": number, "width": number }
  ],
  "rooms": [
    { "name": string, "type": "bedroom|living|kitchen|bathroom|parking|balcony|utility|corridor", "x": number, "y": number, "width": number, "height": number }
  ]
}

Important geometry rules:
- Coordinates are in meta.units.
- Use whole numbers only for all coordinates and sizes (no decimals).
- First 4 walls MUST be the outer rectangle exactly:
  (0,0)->(outerWidth,0)->(outerWidth,outerHeight)->(0,outerHeight)->(0,0)
- room rectangles must be inside the outer boundary and should not overlap.
- Room width/height must match the wall grid so dimensions display correctly.
`.trim();

    const userMessage = `
User request: ${prompt}

Detected requirements:
- bhk: ${reqs.bhk ?? "not specified"}
- bathrooms: ${reqs.bathrooms ?? "not specified (must include at least 1)"}
- parking requested: ${reqs.wantsParking ? "YES" : "NO"}
- balcony/utility/garden requested: ${reqs.wantsBalcony ? "YES" : "NO"}

Plot size to use:
- ${finalDims.outerWidth} x ${finalDims.outerHeight} ${finalDims.units}
(use this EXACTLY in meta and outer walls)

Output ONLY the JSON in the schema.
`.trim();

    // Up to 2 attempts: first call, then one 429-retry after wait
    const diagnostics = [];
    let lastRaw = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aethercad-pro-v2.vercel.app",
            "X-Title": "AetherCAD Pro v2",
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: 0.2,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        });

        const rawText = await response.text();
        lastRaw = rawText;

        // Rate limit: wait and retry once
        if (response.status === 429 && attempt === 1) {
          const waitSec = parseRetryAfterSeconds(rawText, 8);
          diagnostics.push({
            model: MODEL,
            attempt,
            statusCode: 429,
            action: `wait ${waitSec}s then retry`,
          });
          await sleep(waitSec * 1000);
          continue;
        }

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              error: "OpenRouter / Nemotron request failed",
              model: MODEL,
              statusCode: response.status,
              details: rawText,
              diagnostics,
            }),
            { status: 502, headers: corsHeaders }
          );
        }

        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          return new Response(
            JSON.stringify({
              error: "OpenRouter returned non-JSON body",
              details: rawText,
            }),
            { status: 502, headers: corsHeaders }
          );
        }

        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
          return new Response(
            JSON.stringify({
              error: "No content from AI",
              model: MODEL,
              raw: data,
            }),
            { status: 502, headers: corsHeaders }
          );
        }

        const cleaned = content.replace(/```json|```/g, "").trim();
        let plan;
        try {
          plan = JSON.parse(cleaned);
        } catch {
          return new Response(
            JSON.stringify({
              error: "AI did not return valid JSON",
              content: cleaned,
            }),
            { status: 502, headers: corsHeaders }
          );
        }

        // Force correct meta + snap coordinates (measurement fix)
        const alignedPlan = snapGeometryToCleanGrid(plan, finalDims);

        return new Response(JSON.stringify(alignedPlan), {
          status: 200,
          headers: corsHeaders,
        });
      } catch (err) {
        diagnostics.push({
          model: MODEL,
          attempt,
          issue: err.message,
        });

        if (attempt === 1) {
          await sleep(2000);
          continue;
        }
      }
    }

    return new Response(
      JSON.stringify({
        error:
          "Nemotron failed after retries (rate limit, degraded, or timeout). Wait 30–60s and try once more.",
        model: MODEL,
        diagnostics,
        lastRaw,
      }),
      { status: 502, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}