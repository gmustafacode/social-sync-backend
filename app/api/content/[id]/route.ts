import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as any).id
    const { id } = await params

    try {
        // Verify ownership and delete
        const item = await db.contentQueue.findFirst({
            where: { id, userId }
        })

        if (!item) {
            return NextResponse.json({ error: "Content not found" }, { status: 404 })
        }

        await db.contentQueue.delete({
            where: { id }
        })

        return NextResponse.json({ success: true, message: "Content dismissed" })
    } catch (e) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userId = (session.user as any).id
    const { id } = await params
    const body = await request.json()

    try {
        const item = await db.contentQueue.updateMany({
            where: { id, userId },
            data: {
                status: body.status || 'pending'
            }
        })

        if (!item.count) {
            return NextResponse.json({ error: "Content not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}
