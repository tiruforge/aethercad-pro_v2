// api/generate-floorplan.js

export const config = {
  runtime: 'edge', // Bypasses the 10-second limit, allowing up to 30 seconds of processing!
};

// 1. Helper function: Extract plot size using your exact working regex
function extractPlotSize(prompt) {
  const m = prompt.match(/(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?/i);
  if (!m) return null;

  const w = Number(m[1]);
  const h = Number(m[3]);
  let unit = (m[2] || m[4] || "").toLowerCase();

  if (unit === "'" || unit === "ft" || unit === "feet") unit = "ft";
  else if (unit === "m" || unit === "meter" || unit === "meters") unit = "m";
  else if (unit === "cm") unit = "cm";
  else unit = "ft"; // default

  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { units: unit, outerWidth: w, outerHeight: h };
}

// 2. Helper function: Extract requirements using your exact working rules
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

// 3. Helper function: Default plot configurations
function defaultPlotForBHK(bhk) {
  if (bhk === 1) return { units: "ft", outerWidth: 20, outerHeight: 30 };
  if (bhk === 2) return { units: "ft", outerWidth: 30, outerHeight: 40 };
  if (bhk === 3) return { units: "ft", outerWidth: 40, outerHeight: 40 };
  if (bhk >= 4) return { units: "ft", outerWidth: 50, outerHeight: 60 };
  return { units: "ft", outerWidth: 30, outerHeight: 40 };
}

// 4. Non-Destructive Geometry Snapper to align rooms & walls perfectly on integer bounds
function snapGeometryToCleanGrid(plan, finalDims) {
  if (!plan) return plan;

  plan.meta = plan.meta || {};
  plan.meta.units = finalDims.units;
  plan.meta.outerWidth = finalDims.outerWidth;
  plan.meta.outerHeight = finalDims.outerHeight;

  const ow = finalDims.outerWidth;
  const oh = finalDims.outerHeight;

  const snap = (v) => (v !== undefined && v !== null ? Math.round(Number(v)) : 0);

  if (Array.isArray(plan.walls)) {
    plan.walls.forEach(wall => {
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
    plan.rooms.forEach(room => {
      room.x = Math.min(ow, Math.max(0, snap(room.x)));
      room.y = Math.min(oh, Math.max(0, snap(room.y)));
      room.width = Math.min(ow - room.x, Math.max(2, snap(room.width)));
      room.height = Math.min(oh - room.y, Math.max(2, snap(room.height)));
    });
  }

  if (Array.isArray(plan.doors)) {
    plan.doors.forEach(door => {
      door.position = snap(door.position);
      if (door.width !== undefined) door.width = snap(door.width);
    });
  }

  if (Array.isArray(plan.windows)) {
    plan.windows.forEach(win => {
      win.position = snap(win.position);
      if (win.width !== undefined) win.width = snap(win.width);
    });
  }

  return plan;
}

// ULTRA-STABLE NON-CONGESTED MODEL REGISTRY (No hardware outages, no heavy rate-limits!)
const FALLBACK_MODELS = [
  { id: "meta-llama/llama-3-70b-instruct:free", timeout: 15000 },  // Rank #1: Meta's highly available 70B (Fast, rarely rate-limited!)
  { id: "google/gemma-2-27b-it:free", timeout: 8000 },             // Rank #2: Google's spatial reasoning champion (Fully active)
  { id: "meta-llama/llama-3.3-70b-instruct:free", timeout: 5000 }  // Rank #3: Venice logical backup
];

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }), { status: 405, headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), { status: 400, headers: corsHeaders });
    }

    const { prompt } = body || {};
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: corsHeaders });
    }

    const dims = extractPlotSize(prompt);
    const reqs = extractRequirements(prompt);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key configuration missing on server' }), { status: 500, headers: corsHeaders });
    }

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
- First 4 walls MUST be the outer rectangle exactly:
  (0,0)->(outerWidth,0)->(outerWidth,outerHeight)->(0,outerHeight)->(0,0)
- room rectangles must be inside the outer boundary and should not overlap.
`.trim();

    const fallbackDims = defaultPlotForBHK(reqs.bhk);
    const finalDims = dims || fallbackDims;

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

    const diagnostics = [];

    // Process our highly-available fallbacks
    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
      const currentModel = FALLBACK_MODELS[i].id;
      const currentTimeout = FALLBACK_MODELS[i].timeout;
      console.log(`Routing on Edge: ${currentModel} (Timeout limit: ${currentTimeout}ms)`);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aethercad-pro-v2.vercel.app",
            "X-Title": "AetherCAD Pro v2"
          },
          body: JSON.stringify({
            model: currentModel,
            temperature: 0.2,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
          }),
          signal: AbortSignal.timeout(currentTimeout)
        });

        const rawText = await response.text();

        if (!response.ok) {
          diagnostics.push({ model: currentModel, statusCode: response.status, details: rawText });
          continue;
        }

        let parsedData = JSON.parse(rawText);
        const content = parsedData?.choices?.[0]?.message?.content;
        
        if (!content) {
          diagnostics.push({ model: currentModel, issue: "Empty content returned" });
          continue;
        }

        const cleaned = content.replace(/```json|```/g, "").trim();
        let plan = JSON.parse(cleaned);

        // Run coordinate snap grid alignment
        const alignedPlan = snapGeometryToCleanGrid(plan, finalDims);

        console.log(`Success! Floorplan generated on Edge with model: ${currentModel}`);
        return new Response(JSON.stringify(alignedPlan), { status: 200, headers: corsHeaders });

      } catch (err) {
        console.warn(`Edge attempt with ${currentModel} encountered issue:`, err.message);
        diagnostics.push({ model: currentModel, issue: err.message });
        continue;
      }
    }

    return new Response(JSON.stringify({
      error: "The AI servers are currently congested. Please wait a few seconds and try again.",
      diagnostics: diagnostics
    }), { status: 502, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}