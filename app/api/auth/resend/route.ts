import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/mail';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: "Missing email" }, { status: 400 });
        }

        const user = await db.user.findUnique({
            where: { email }
        });

        // Security: Return generic success even if user doesn't exist to prevent enumeration
        if (!user) {
            return NextResponse.json({
                success: true,
                message: "If an account exists for this email, a verification link has been sent."
            });
        }

        if (user.emailVerified) {
            return NextResponse.json({ error: "Email already verified" }, { status: 400 });
        }

        // Rate Limiting: Check if a token was recently created for this identifier
        const existingToken = await db.verificationToken.findFirst({
            where: { identifier: email },
            orderBy: { expires: 'desc' }
        });

        if (existingToken) {
            const timeSinceCreation = Date.now() - (existingToken.expires.getTime() - 3600000);
            if (timeSinceCreation < 60000) { // 60s cooldown
                return NextResponse.json({
                    error: "Please wait a minute before requesting another email."
                }, { status: 429 });
            }
        }

        // Generate new token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        // Clean up old tokens and create new one
        await db.verificationToken.deleteMany({
            where: { identifier: email }
        });

        await db.verificationToken.create({
            data: {
                identifier: email,
                token: token,
                expires: expires,
            }
        });

        await sendVerificationEmail(email, token);

        return NextResponse.json({
            success: true,
            message: "Verification email resent successfully."
        });

    } catch (error) {
        console.error("Resend verification error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
