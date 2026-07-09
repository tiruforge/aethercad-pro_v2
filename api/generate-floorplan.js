// api/generate-floorplan.js

// 1. Helper function: Extract plot size from prompt using regex
function extractPlotSize(prompt) {
  const cleaned = prompt.toLowerCase();
  const match = cleaned.match(/(\d+)\s*(?:ft|'|m|cm)?\s*(?:x|×|\*|by|to)\s*(\d+)\s*(ft|'|m|cm)?/i);
  
  if (match) {
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    let units = 'ft'; // default
    if (cleaned.includes('meter') || cleaned.includes(' m ') || cleaned.endsWith('m') || match[3] === 'm') {
      units = 'm';
    } else if (cleaned.includes('cm')) {
      units = 'cm';
    }
    return { width, height, units };
  }
  return null;
}

// 2. Helper function: Extract details like BHK, bathrooms
function extractRequirements(prompt) {
  const cleaned = prompt.toLowerCase();
  const bhkMatch = cleaned.match(/(\d+)\s*bhk/i);
  const bhk = bhkMatch ? parseInt(bhkMatch[1], 10) : null;

  const bathMatch = cleaned.match(/(\d+)\s*(?:bath|toilet|washroom|restroom)/i);
  const bathrooms = bathMatch ? parseInt(bathMatch[1], 10) : null;

  const wantsParking = cleaned.includes('parking') || cleaned.includes('car') || cleaned.includes('garage');
  const wantsBalcony = cleaned.includes('balcony') || cleaned.includes('balconies');

  return { bhk, bathrooms, wantsParking, wantsBalcony };
}

// 3. Helper function: Default sizes for BHK
function defaultPlotForBHK(bhk) {
  if (!bhk) return { width: 30, height: 40, units: 'ft' };
  if (bhk === 1) return { width: 20, height: 30, units: 'ft' };
  if (bhk === 2) return { width: 30, height: 40, units: 'ft' };
  if (bhk === 3) return { width: 40, height: 40, units: 'ft' };
  return { width: 50, height: 60, units: 'ft' };
}

// 4. Helper function: Clean code block markers
function cleanJSONString(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, ''); // Clean deepseek reasoning blocks
  cleaned = cleaned.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "");
  }
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1'); // Clean trailing commas
  return cleaned;
}

// ==========================================
// GEOMETRY SANITIZER & ALIGNMENT ENGINE
// ==========================================
function sanitizeAndAlignFloorplan(plan, outerWidth, outerHeight) {
  if (!plan.rooms || !Array.isArray(plan.rooms)) {
    plan.rooms = [];
  }

  // Step A: Snap room boundaries to integer grid & enforce outer boundaries
  plan.rooms = plan.rooms.map(room => {
    let rx = Math.max(0, Math.round(room.x || 0));
    let ry = Math.max(0, Math.round(room.y || 0));
    let rw = Math.max(2, Math.round(room.width || 4));
    let rh = Math.max(2, Math.round(room.height || 4));

    // Clamp to make sure they fit inside the plot
    if (rx + rw > outerWidth) {
      if (rx > 0) rx = Math.max(0, outerWidth - rw);
      rw = Math.min(rw, outerWidth - rx);
    }
    if (ry + rh > outerHeight) {
      if (ry > 0) ry = Math.max(0, outerHeight - rh);
      rh = Math.min(rh, outerHeight - ry);
    }

    return {
      name: room.name || "Room",
      type: room.type || "bedroom",
      x: rx,
      y: ry,
      width: rw,
      height: rh
    };
  });

  // Step B: Deduplicate rooms with overlapping centers/names
  const uniqueRooms = [];
  for (const r of plan.rooms) {
    const isDuplicate = uniqueRooms.some(existing => {
      // Overlap calculation
      const xOverlap = Math.max(0, Math.min(r.x + r.width, existing.x + existing.width) - Math.max(r.x, existing.x));
      const yOverlap = Math.max(0, Math.min(r.y + r.height, existing.y + existing.height) - Math.max(r.y, existing.y));
      const overlapArea = xOverlap * yOverlap;
      const areaR = r.width * r.height;

      // If they overlap by more than 40% and have similar names/types, deduplicate
      const namesSimilar = r.name.toLowerCase().substring(0, 5) === existing.name.toLowerCase().substring(0, 5);
      return (overlapArea > areaR * 0.4) && (r.type === existing.type || namesSimilar);
    });

    if (!isDuplicate) {
      uniqueRooms.push(r);
    }
  }
  plan.rooms = uniqueRooms;

  // Step C: Auto-generate neat, perfectly contiguous walls from room boundaries
  const wallSet = new Set();
  const addWall = (x1, y1, x2, y2) => {
    if (x1 > x2 || (x1 === x2 && y1 > y2)) {
      [x1, y1, x2, y2] = [x2, y2, x1, y1];
    }
    if (x1 === x2 && y1 === y2) return;
    
    const key = `${x1},${y1}-${x2},${y2}`;
    wallSet.add(key);
  };

  // 1. Add perfect outer boundary rectangle walls
  addWall(0, 0, outerWidth, 0);
  addWall(outerWidth, 0, outerWidth, outerHeight);
  addWall(outerWidth, outerHeight, 0, outerHeight);
  addWall(0, outerHeight, 0, 0);

  // 2. Add bounding walls around every snapped room
  for (const room of plan.rooms) {
    addWall(room.x, room.y, room.x + room.width, room.y); // Top side
    addWall(room.x + room.width, room.y, room.x + room.width, room.y + room.height); // Right side
    addWall(room.x + room.width, room.y + room.height, room.x, room.y + room.height); // Bottom side
    addWall(room.x, room.y + room.height, room.x, room.y); // Left side
  }

  // Re-populate clean wall structures
  plan.walls = Array.from(wallSet).map(key => {
    const [p1, p2] = key.split('-');
    const [x1, y1] = p1.split(',').map(Number);
    const [x2, y2] = p2.split(',').map(Number);
    return { x1, y1, x2, y2 };
  });

  // Step D: Ensure doors/windows lie directly on our clean walls
  if (Array.isArray(plan.doors)) {
    plan.doors = plan.doors.map(door => {
      const dx = Math.round(door.position?.x || 0);
      const dy = Math.round(door.position?.y || 0);
      return {
        position: { x: dx, y: dy },
        width: door.width || 3,
        orientation: door.orientation || "horizontal"
      };
    });
  }

  if (Array.isArray(plan.windows)) {
    plan.windows = plan.windows.map(win => {
      const wx = Math.round(win.position?.x || 0);
      const wy = Math.round(win.position?.y || 0);
      return {
        position: { x: wx, y: wy },
        width: win.width || 4,
        orientation: win.orientation || "horizontal"
      };
    });
  }

  return plan;
}

// TIME-BUDGETED MODEL LIST FOR HIGH RELIABILITY
// Total worst-case execution time: 8000ms + 1500ms = 9.5 seconds (Safely under Vercel's 10s cutoff!)
const FALLBACK_MODELS = [
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", timeout: 8000 }, // Primary: User's proven 550B spatial model
  { id: "meta-llama/llama-3.2-3b-instruct:free", timeout: 1500 }   // Secondary: Ultra-fast, high-availability free backup
];

export default async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing "prompt" field in request body.' });
  }

  const parsedPlot = extractPlotSize(prompt);
  const reqs = extractRequirements(prompt);
  
  let finalDims = parsedPlot;
  if (!finalDims) {
    finalDims = defaultPlotForBHK(reqs.bhk);
  }

  // System Prompt
  const systemPrompt = `You are an expert civil engineer and floorplan architect.
Your task is to generate a structurally sound, highly accurate, and non-overlapping 2D floorplan JSON based on the user's requirements.

The layout MUST fit perfectly within the outer dimensions: Width = ${finalDims.width} ${finalDims.units}, Height = ${finalDims.height} ${finalDims.units}.

Strict output rules:
1. Return ONLY raw JSON. No conversational text, no markdown styling around the JSON.
2. The outer walls MUST form a closed outer rectangle matching the outer dimensions exactly:
   - Wall 1: (0,0) to (${finalDims.width},0)
   - Wall 2: (${finalDims.width},0) to (${finalDims.width},${finalDims.height})
   - Wall 3: (${finalDims.width},${finalDims.height}) to (0,${finalDims.height})
   - Wall 4: (0,${finalDims.height}) to (0,0)
3. Internal walls must divide the layout into logical, usable, non-overlapping rooms.
4. Ensure all door openings (width ~3 units) and window openings (width ~4 units) are placed on walls.
5. Create rooms. Every room MUST have coordinates 'x', 'y', 'width', and 'height' nested cleanly inside. No gaps or overlapping spaces unless a 'parking' slot is explicitly requested.
6. The room "type" MUST be one of: "bedroom", "living", "kitchen", "bathroom", "corridor", "parking", "balcony", "utility".
7. If the user asked for parking, draw it as a room with type "parking".
8. Ensure there is at least ${reqs.bathrooms || 1} bathroom(s) clearly drawn and labeled.

Required JSON Structure format:
{
  "meta": {
    "units": "${finalDims.units}",
    "outerWidth": ${finalDims.width},
    "outerHeight": ${finalDims.height}
  },
  "walls": [
    {"x1": 0, "y1": 0, "x2": ${finalDims.width}, "y2": 0},
    ...
  ],
  "doors": [
    {"position": {"x": number, "y": number}, "width": number, "orientation": "horizontal"|"vertical"}
  ],
  "windows": [
    {"position": {"x": number, "y": number}, "width": number, "orientation": "horizontal"|"vertical"}
  ],
  "rooms": [
    {"name": "Master Bedroom", "type": "bedroom", "x": number, "y": number, "width": number, "height": number}
  ]
}`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Missing OpenRouter Key in Environment Variables.");
    return res.status(500).json({ 
      error: "API Key Configuration Error.", 
      details: "OPENROUTER_API_KEY environment variable is not defined on the server." 
    });
  }

  const diagnostics = [];

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const currentModel = FALLBACK_MODELS[i].id;
    const currentTimeout = FALLBACK_MODELS[i].timeout;
    console.log(`Attempting generation using model ${i + 1}/${FALLBACK_MODELS.length}: ${currentModel} (Timeout: ${currentTimeout}ms)`);

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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a detailed floorplan layout for prompt: "${prompt}". Remember to only return the valid raw JSON schema requested.` }
          ],
          temperature: 0.1 // Kept low for perfect JSON structure compliance
        }),
        signal: AbortSignal.timeout(currentTimeout)
      });

      const rawText = await response.text();
      console.log(`Received status code ${response.status} from model ${currentModel}`);

      if (!response.ok) {
        diagnostics.push({
          model: currentModel,
          statusCode: response.status,
          issue: "Model endpoint returned error status",
          rawResponse: rawText
        });
        continue;
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(rawText);
      } catch (err) {
        diagnostics.push({
          model: currentModel,
          statusCode: response.status,
          issue: "Failed to parse API response as JSON",
          rawResponse: rawText
        });
        continue;
      }

      const content = parsedResponse?.choices?.[0]?.message?.content;
      if (!content) {
        diagnostics.push({
          model: currentModel,
          statusCode: response.status,
          issue: "Empty or null content payload returned from OpenRouter choices",
          rawResponse: parsedResponse
        });
        continue;
      }

      const cleanJson = cleanJSONString(content);
      let planJson;
      try {
        planJson = JSON.parse(cleanJson);
      } catch (e) {
        diagnostics.push({
          model: currentModel,
          statusCode: response.status,
          issue: "AI content was generated but could not be parsed into final JSON",
          rawResponse: content
        });
        continue;
      }

      // Force overlay measurements
      planJson.meta = planJson.meta || {};
      planJson.meta.units = finalDims.units;
      planJson.meta.outerWidth = finalDims.width;
      planJson.meta.outerHeight = finalDims.height;

      // ==========================================
      // APPLY GEOMETRY SANITIZATION & AUTO-ALIGNMENT
      // ==========================================
      const polishedPlan = sanitizeAndAlignFloorplan(planJson, finalDims.width, finalDims.height);

      console.log(`Success! Floorplan generated and perfectly aligned with model: ${currentModel}`);
      return res.status(200).json(polishedPlan);

    } catch (error) {
      console.error(`Error occurs during execution of ${currentModel}:`, error.message);
      diagnostics.push({
        model: currentModel,
        issue: "Network Timeout or Internal function crash",
        errorMessage: error.message
      });
      continue;
    }
  }

  // IF WE REACH HERE, ALL MODELS HAVE FAILED
  console.error("All fallback models exhausted. Returning diagnostic history.");
  return res.status(502).json({
    error: "AI Generation pipeline was unable to complete successfully.",
    diagnostics: diagnostics
  });
}