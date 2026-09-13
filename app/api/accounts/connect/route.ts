import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"
import { encrypt } from "@/lib/encryption"

export async function POST(request: Request) {
    // 1. Validate Session
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { platform, accessToken, refreshToken, permissions, expiry } = body

        if (!platform || !accessToken) {
            // If mock connect, generate mock token
            if (platform) {
                const mockToken = `mock_token_${Date.now()}`

                // Save to DB
                const account = await db.socialAccount.create({
                    data: {
                        userId: (session.user as any).id || "demo-user-id", // Fallback for pure demo without real DB user
                        platform: platform,
                        encryptedAccessToken: encrypt(mockToken),
                        encryptedRefreshToken: refreshToken ? encrypt(refreshToken) : null,
                        status: "active",
                        scopes: JSON.stringify(permissions || []),
                    }
                })

                return NextResponse.json({ success: true, accountId: account.id })
            }
            return NextResponse.json({ error: "Missing fields" }, { status: 400 })
        }

        // 2. Encrypt & Save
        const userId = (session.user as any).id

        await db.socialAccount.create({
            data: {
                userId,
                platform,
                encryptedAccessToken: encrypt(accessToken),
                encryptedRefreshToken: refreshToken ? encrypt(refreshToken) : null,
                accessTokenExpiresAt: expiry ? new Date(expiry) : null,
                scopes: permissions ? JSON.stringify(permissions) : null,
                status: "active"
            }
        })

        return NextResponse.json({ success: true })

    } catch (e) {
        console.error(e)
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
    }
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = (session.user as any).id

    try {
        const accounts = await db.socialAccount.findMany({
            where: { userId },
            select: {
                id: true,
                platform: true,
                status: true,
                connectedAt: true
            }
        })
        return NextResponse.json(accounts)
    } catch (e) {
        return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
    }
}
