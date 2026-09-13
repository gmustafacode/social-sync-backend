const deployedServiceUrl = 'https://newproject-chi-gold.vercel.app';

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { batch_size?: number };
    const batchSize = body.batch_size || 10;

    // Call Python Service
    const env = (globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> }
    }).process?.env;
    let pythonServiceUrl = env?.AI_SERVICE_URL;

    if (env?.NODE_ENV === 'production' && !pythonServiceUrl) {
      console.error("Missing AI_SERVICE_URL in production environment");
      return jsonResponse({ error: "Configuration Error: AI Service Unavailable" }, 503);
    }

    if (!pythonServiceUrl) {
      pythonServiceUrl = deployedServiceUrl;
    }

    console.log(`Triggering AI Analysis at ${pythonServiceUrl} with batch size ${batchSize}`);

    const response = await fetch(`${pythonServiceUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ batch_size: batchSize }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: `AI Service Error: ${errorText}` }, response.status);
    }

    const data = await response.json();
    return jsonResponse(data);

  } catch (error: unknown) {
    console.error('Error triggering AI analysis:', error);
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    return jsonResponse({ error: message }, 500);
  }
}
