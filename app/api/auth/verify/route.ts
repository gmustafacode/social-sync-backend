import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    try {
        const verificationToken = await db.verificationToken.findUnique({
            where: { token }
        });

        if (!verificationToken || verificationToken.expires < new Date()) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
        }

        // Atomic Update: Verify user and clean up token
        await db.$transaction([
            db.user.update({
                where: { email: verificationToken.identifier },
                data: { emailVerified: new Date() }
            }),
            db.verificationToken.delete({
                where: { token }
            })
        ]);

        return NextResponse.redirect(new URL('/login?verified=true', request.url));

    } catch (error) {
        console.error("Verification error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
