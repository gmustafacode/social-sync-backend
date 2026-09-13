import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        // Try a simple query
        await db.$queryRaw`SELECT 1`;
        return NextResponse.json({
            status: "Connected ✅",
            message: "Database connectivity is working perfectly!",
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error("Connectivity test failed:", error);
        return NextResponse.json({
            status: "Failed ❌",
            error: error.message,
            code: error.code,
            clientVersion: error.clientVersion,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
