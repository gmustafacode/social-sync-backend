import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai-service';

/**
 * API Trigger for AI Analysis
 * Usage: POST /api/ai/analyze { "batchSize": 10 }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const batchSize = body.batchSize || 10;

        console.log(`[API] Triggering AI Analysis for batch size: ${batchSize}`);

        const stats = await AIService.processBatch(batchSize);

        return NextResponse.json({
            message: "Success",
            stats
        });

    } catch (error: any) {
        console.error("[API] AI Analysis Error:", error);
        return NextResponse.json({
            error: error.message || "Internal Server Error"
        }, { status: 500 });
    }
}
