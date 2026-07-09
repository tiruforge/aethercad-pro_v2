// api/generate-floorplan.js

// 1. Helper function: Extract plot size using your proven regex
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

// 2. Helper function: Extract requirements
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
function alignAndSnapGeometry(plan, finalDims) {
  if (!plan) return plan;

  // Enforce outer plot constraints to prevent math drifting
  plan.meta = plan.meta || {};
  plan.meta.units = finalDims.units;
  plan.meta.outerWidth = finalDims.outerWidth;
  plan.meta.outerHeight = finalDims.outerHeight;

  const ow = finalDims.outerWidth;
  const oh = finalDims.outerHeight;

  // Snaps coordinate to nearest whole integer
  const snap = (v) => (v !== undefined ? Math.round(Number(v)) : 0);

  // A. Snap wall segments perfectly to the grid bounds
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

  // B. Snap rooms coordinates to align with wall edges
  if (Array.isArray(plan.rooms)) {
    plan.rooms.forEach(room => {
      room.x = Math.min(ow, Math.max(0, snap(room.x)));
      room.y = Math.min(oh, Math.max(0, snap(room.y)));
      room.width = Math.min(ow - room.x, Math.max(2, snap(room.width)));
      room.height = Math.min(oh - room.y, Math.max(2, snap(room.height)));
    });
  }

  // C. Round doors/windows along their mapped wallIndex
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

// Highly reliable working free models
const FALLBACK_MODELS = [
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", timeout: 7500 }, // Priority #1: User's working model (allowed 7.5s)
  { id: "meta-llama/llama-3.3-70b-instruct:free", timeout: 2000 }  // Priority #2: Venice backup (allowed 2s)
];

export default async function handler(req, res) {
  // Set CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const dims = extractPlotSize(prompt);
    const reqs = extractRequirements(prompt);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing in environment configurations" });
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

    // Cycle fallback models under standard Node runtime
    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
      const currentModel = FALLBACK_MODELS[i].id;
      const currentTimeout = FALLBACK_MODELS[i].timeout;

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
          diagnostics.push({ model: currentModel, issue: "Empty response content" });
          continue;
        }

        // Clean up markdown block fences if present
        const cleaned = content.replace(/```json|```/g, "").trim();
        let plan = JSON.parse(cleaned);

        // Apply non-destructive coordinate snapping
        const alignedPlan = alignAndSnapGeometry(plan, finalDims);

        console.log(`Success! Compiled layout with model: ${currentModel}`);
        return res.status(200).json(alignedPlan);

      } catch (err) {
        diagnostics.push({ model: currentModel, issue: err.message });
        continue;
      }
    }

    // Return structured diagnostics if everything failed
    return res.status(502).json({
      error: "AI Generation pipeline was unable to complete successfully.",
      diagnostics: diagnostics
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}