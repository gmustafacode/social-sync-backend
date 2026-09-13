import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
    const params = await context.params
    const userId = params.userId
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const logs = await db.aiLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        })
        return NextResponse.json(logs)
    } catch (e) {
        return NextResponse.json({ error: "Error" }, { status: 500 })
    }
}
