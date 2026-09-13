import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params
    const id = params.id

    // Auth Check
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).id !== id) {
        // Allow if user is admin? For now only self can access
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const user = await db.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                createdAt: true,
                // custom fields
                preferences: true,
                socialAccounts: {
                    select: { platform: true, status: true }
                }
            }
        })
        return NextResponse.json(user)
    } catch (e) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params
    const id = params.id

    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).id !== id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { preferences } = body

        const updatedUser = await db.user.update({
            where: { id },
            data: {
                preferences: {
                    upsert: {
                        create: {
                            preferredContentTypes: preferences?.preferredContentTypes,
                            postingSchedule: preferences?.postingSchedule,
                            notificationsEnabled: preferences?.notificationsEnabled ?? true,
                        },
                        update: {
                            preferredContentTypes: preferences?.preferredContentTypes,
                            postingSchedule: preferences?.postingSchedule,
                            notificationsEnabled: preferences?.notificationsEnabled,
                        }
                    }
                }
            },
            include: { preferences: true }
        })

        return NextResponse.json(updatedUser)
    } catch (error) {
        console.error("Failed to update preferences:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
