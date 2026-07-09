// api/generate-floorplan.js
export const config = { runtime: 'edge' };

function extractPlotSize(prompt) {
  const m = prompt.match(/(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?/i);
  if (!m) return null;
  const w = Number(m[1]); const h = Number(m[3]);
  let unit = (m[2] || m[4] || "").toLowerCase();
  if (unit === "'" || unit === "ft" || unit === "feet") unit = "ft";
  else if (unit === "m" || unit === "meter" || unit === "meters") unit = "m";
  else if (unit === "cm") unit = "cm"; else unit = "ft";
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { units: unit, outerWidth: w, outerHeight: h };
}

function extractRequirements(prompt) {
  const p = String(prompt || "").toLowerCase();
  const bhk = p.match(/(\d+)\s*bhk/) ? Number(RegExp.$1) : null;
  const bathrooms = p.match(/(\d+)\s*(bath|bathroom|toilet|washroom)s?/) ? Number(RegExp.$1) : null;
  return {
    bhk, bathrooms,
    wantsParking: /(parking|car\s*park|carpark)/.test(p),
    wantsBalcony: /(balcony|utility|garden|courtyard|sitout)/.test(p)
  };
}

function defaultPlotForBHK(bhk) {
  if (bhk === 1) return { units: "ft", outerWidth: 20, outerHeight: 30 };
  if (bhk === 2) return { units: "ft", outerWidth: 30, outerHeight: 40 };
  if (bhk === 3) return { units: "ft", outerWidth: 40, outerHeight: 40 };
  if (bhk >= 4) return { units: "ft", outerWidth: 50, outerHeight: 60 };
  return { units: "ft", outerWidth: 30, outerHeight: 40 };
}

function snapGeometry(plan, finalDims) {
  if (!plan) return plan;
  plan.meta = { ...finalDims, ...plan.meta };
  const snap = v => v !== undefined ? Math.round(Number(v)) : 0;
  if (plan.walls) plan.walls.forEach(w => { w.x1 = snap(w.x1); w.y1 = snap(w.y1); w.x2 = snap(w.x2); w.y2 = snap(w.y2); });
  if (plan.rooms) plan.rooms.forEach(r => { r.x = snap(r.x); r.y = snap(r.y); r.width = snap(r.width); r.height = snap(r.height); });
  if (plan.doors) plan.doors.forEach(d => { d.position = snap(d.position); if (d.width) d.width = snap(d.width); });
  if (plan.windows) plan.windows.forEach(w => { w.position = snap(w.position); if (w.width) w.width = snap(w.width); });
  return plan;
}

const WORKING_MODELS = [
  "mistralai/mistral-7b-instruct:free",
  "openchat/openchat-7b:free",
  "nousresearch/hermes-2-pro-mistral-7b:free"
];

export default async function handler(req) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });

  try {
    const { prompt } = await req.json() || {};
    if (!prompt) return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400, headers: cors });

    const dims = extractPlotSize(prompt);
    const reqs = extractRequirements(prompt);
    const finalDims = dims || defaultPlotForBHK(reqs.bhk);
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API key missing" }), { status: 500, headers: cors });

    const system = `You are a CAD floorplan generator. Return ONLY valid JSON.
Rules:
- If plot size provided (e.g., 30ft x 40ft), MATCH IT EXACTLY in meta and outer walls.
- If user specifies bathroom count, include EXACTLY that many. Else include at least 1.
- ONLY reserve space for parking/balcony/utility if user requests it. Else use plot efficiently.
- First 4 walls MUST be: (0,0)->(outerWidth,0)->(outerWidth,outerHeight)->(0,outerHeight)->(0,0)

Schema:
{
  "meta": { "units": "ft|m|cm", "outerWidth": number, "outerHeight": number },
  "walls": [{"x1": number, "y1": number, "x2": number, "y2": number, "thickness": number}],
  "doors": [{"wallIndex": number, "position": number, "width": number}],
  "windows": [{"wallIndex": number, "position": number, "width": number}],
  "rooms": [{"name": string, "type": string, "x": number, "y": number, "width": number, "height": number}]
}`;

    const user = `User request: ${prompt}
Detected: BHK=${reqs.bhk}, Bathrooms=${reqs.bathrooms}, Parking=${reqs.wantsParking}, Balcony=${reqs.wantsBalcony}
Plot: ${finalDims.outerWidth} x ${finalDims.outerHeight} ${finalDims.units}
Output ONLY JSON in schema.`;

    for (const model of WORKING_MODELS) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aethercad-pro-v2.vercel.app",
            "X-Title": "AetherCAD Pro"
          },
          body: JSON.stringify({ model, temperature: 0.2, messages: [{role:"system",content:system},{role:"user",content:user}] }),
          signal: AbortSignal.timeout(15000)
        });
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) continue;
        const cleaned = content.replace(/```json|```/g, "").trim();
        const plan = JSON.parse(cleaned);
        return new Response(JSON.stringify(snapGeometry(plan, finalDims)), { status: 200, headers: cors });
      } catch (e) { continue; }
    }

    return new Response(JSON.stringify({ error: "All AI models busy. Try again in 30 seconds." }), { status: 502, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  }
}