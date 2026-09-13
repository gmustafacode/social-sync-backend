import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const batchSize = body.batch_size || 10;

    // Call Python Service
    let pythonServiceUrl = process.env.AI_SERVICE_URL;

    if (process.env.NODE_ENV === 'production' && !pythonServiceUrl) {
      console.error("Missing AI_SERVICE_URL in production environment");
      return NextResponse.json({ error: "Configuration Error: AI Service Unavailable" }, { status: 503 });
    }

    if (!pythonServiceUrl) {
      pythonServiceUrl = 'http://localhost:8000'; // Dev fallback
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
      return NextResponse.json({ error: `AI Service Error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error triggering AI analysis:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
