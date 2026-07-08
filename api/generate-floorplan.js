function extractPlotSize(prompt) {
  // Matches: 30x40, 30 x 40 ft, 30ft×40ft, 30' x 40', 12m x 9m, 1200cm x 900cm
  const m = prompt.match(/(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|meters|cm|')?/i);
  if (!m) return null;

  const w = Number(m[1]);
  const h = Number(m[3]);
  let unit = (m[2] || m[4] || "").toLowerCase();

  if (unit === "'" || unit === "ft" || unit === "feet") unit = "ft";
  else if (unit === "m" || unit === "meter" || unit === "meters") unit = "m";
  else if (unit === "cm") unit = "cm";
  else unit = "ft"; // default if user didn't specify

  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { units: unit, outerWidth: w, outerHeight: h };
}
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }
    const dims = extractPlotSize(prompt);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    const system = `
You are a CAD floorplan generator.

Return ONLY valid JSON (no markdown, no explanation, no extra text).

If the user provides plot size (like 30ft x 40ft), you MUST match it exactly.

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
  ]
    "rooms": [
  { "name": "Master Bedroom", "x": number, "y": number, "width": number, "height": number }
]
}

Rules:
- Coordinates are in meta.units.
- The FIRST 4 walls MUST be the outer rectangle exactly:
  0: (0,0)->(outerWidth,0)
  1: (outerWidth,0)->(outerWidth,outerHeight)
  2: (outerWidth,outerHeight)->(0,outerHeight)
  3: (0,outerHeight)->(0,0)
- All values must be numbers (not strings).
- Include interior walls to form rooms for the request (2BHK/3BHK etc).
`.trim();

const user = `
User request: ${prompt}
${dims ? `Plot size detected: ${dims.outerWidth} x ${dims.outerHeight} ${dims.units}. Use this EXACTLY.` : `No plot size detected. Choose reasonable defaults and set meta.outerWidth/meta.outerHeight.`}

Output ONLY the JSON in the schema.
`.trim();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
      }),
    });

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: "No content from AI", raw: data });
    }

    // Remove ```json fences if model returns them
    const cleaned = content.replace(/```json|```/g, "").trim();

    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({
        error: "AI did not return valid JSON",
        content: cleaned,
      });
    }

    return res.status(200).json(plan);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}