// api/generate-floorplan.js

// 1. Helper function: Extract plot size from prompt using regex
function extractPlotSize(prompt) {
  const cleaned = prompt.toLowerCase();
  // Matches patterns like "30x40", "30 x 40 ft", "30ft x 40ft", "30' x 40'", "12m x 9m"
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

// 2. Helper function: Extract details like rooms, parking, balcony
function extractRequirements(prompt) {
  const cleaned = prompt.toLowerCase();
  const bhkMatch = cleaned.match(/(\d+)\s*bhk/i);
  const bhk = bhkMatch ? parseInt(bhkMatch[1], 10) : null;

  const bathMatch = cleaned.match(/(\d+)\s*(?:bath|toilet|washroom|restroom)/i);
  const bathrooms = bathMatch ? parseInt(bathMatch[1], 10) : null;

  const wantsParking = cleaned.includes('parking') || cleaned.includes('car') || cleaned.includes('garage');
  const wantsBalcony = cleaned.includes('balcony') || cleaned.includes('balconies');
  const wantsAttached = cleaned.includes('attached');

  return { bhk, bathrooms, wantsParking, wantsBalcony, wantsAttached };
}

// 3. Helper function: Default sizes for BHK if user didn't mention size
function defaultPlotForBHK(bhk) {
  if (!bhk) return { width: 30, height: 40, units: 'ft' };
  if (bhk === 1) return { width: 20, height: 30, units: 'ft' };
  if (bhk === 2) return { width: 30, height: 40, units: 'ft' };
  if (bhk === 3) return { width: 40, height: 40, units: 'ft' };
  return { width: 50, height: 60, units: 'ft' };
}

// 4. Helper function: Clean code block markers from AI string
function cleanJSONString(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "");
  }
  return cleaned.trim();
}

// HIGHLY OPTIMIZED FALLBACK MODEL CHAIN FROM YOUR MODEL RESEARCH
const FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",    // Rank #1: Best logic, instruction adherence
  "qwen/qwen-2.5-coder-32b-instruct:free",     // Rank #2: Best structural coding and JSON output
  "nousresearch/hermes-3-llama-3.1-405b:free",  // Rank #3: Massive intelligence fallback (slow but highly accurate)
  "qwen/qwen-2.5-72b-instruct:free"            // Rank #4: Excellent alternative high-capacity reasoning model
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

  // Parse custom prompt structures
  const parsedPlot = extractPlotSize(prompt);
  const reqs = extractRequirements(prompt);
  
  let finalDims = parsedPlot;
  if (!finalDims) {
    finalDims = defaultPlotForBHK(reqs.bhk);
  }

  // System Prompt for strict layout structure
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

  // Iterate over models to handle rate limits / 429s / down times
  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const currentModel = FALLBACK_MODELS[i];
    console.log(`Attempting generation using model ${i + 1}/${FALLBACK_MODELS.length}: ${currentModel}`);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aethercad-pro-v2.vercel.app", // Custom header preventing rate limiting on OpenRouter
          "X-Title": "AetherCAD Pro v2"
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a detailed floorplan layout for prompt: "${prompt}". Remember to only return the valid raw JSON schema requested.` }
          ],
          temperature: 0.2 // Lower temp = more predictable JSON compliance
        }),
        signal: AbortSignal.timeout(15000) // 15 seconds timeout per model attempt
      });

      const rawText = await response.text();
      console.log(`Received status code ${response.status} from OpenRouter using model ${currentModel}`);

      if (!response.ok) {
        console.warn(`Model ${currentModel} returned error: ${rawText}`);
        // If not the last model, wait briefly and try the next fallback
        if (i < FALLBACK_MODELS.length - 1) {
          console.log("Waiting 2 seconds before attempting fallback model...");
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        return res.status(502).json({
          error: `OpenRouter returned status code ${response.status}`,
          details: rawText
        });
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(rawText);
      } catch (err) {
        console.error(`Failed to parse response body as JSON: ${rawText}`);
        if (i < FALLBACK_MODELS.length - 1) {
          continue;
        }
        return res.status(502).json({
          error: "Invalid JSON response from OpenRouter provider",
          details: rawText
        });
      }

      const content = parsedResponse?.choices?.[0]?.message?.content;
      if (!content) {
        console.warn(`Model ${currentModel} returned empty content object:`, JSON.stringify(parsedResponse));
        if (i < FALLBACK_MODELS.length - 1) {
          continue;
        }
        return res.status(502).json({
          error: "Empty message payload received from AI model.",
          details: parsedResponse
        });
      }

      // Safe parse AI generated JSON code blocks
      const cleanJson = cleanJSONString(content);
      let planJson;
      try {
        planJson = JSON.parse(cleanJson);
      } catch (e) {
        console.error(`AI generated content could not be parsed as final floorplan JSON: ${cleanJson}`);
        if (i < FALLBACK_MODELS.length - 1) {
          continue;
        }
        return res.status(502).json({
          error: "AI response failed JSON structure parsing rules.",
          details: content
        });
      }

      // Enforce outer bounds to prevent AI drift
      if (!planJson.meta) planJson.meta = {};
      planJson.meta.units = finalDims.units;
      planJson.meta.outerWidth = finalDims.width;
      planJson.meta.outerHeight = finalDims.height;

      console.log("Floorplan layout successfully compiled and sanitized!");
      return res.status(200).json(planJson);

    } catch (error) {
      console.error(`Network or critical error with model ${currentModel}:`, error.message);
      if (i < FALLBACK_MODELS.length - 1) {
        console.log("Waiting 2 seconds before retry/fallback...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      return res.status(500).json({
        error: "Internal Server / Connection Error with OpenRouter API.",
        details: error.message
      });
    }
  }
}