
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LinkedInAuthService } from "@/lib/linkedin-auth-service";
import axios from 'axios';

/**
 * Fetches the user's LinkedIn Group membership.
 * Requires memberSettings and groupAssociations.
 */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
        return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
    }

    try {
        const userId = (session.user as any).id;

        // 1. Get valid token
        const accessToken = await LinkedInAuthService.getValidToken(accountId);

        // 2. Fetch Member Profile for URN (required for filtering)
        const meRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const personUrn = `urn:li:person:${meRes.data.sub}`;

        // 3. Fetch Group Memberships
        // Strategy: Use /v2/groupMemberships?q=member&member={personUrn}
        // This requires 'r_member_social' or specific group permissions.
        const res = await axios.get('https://api.linkedin.com/v2/groupMemberships', {
            params: {
                q: 'member',
                member: personUrn,
                state: 'APPROVED'
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        // 4. Extract Group Info
        // Each entry has a 'group' URN (urn:li:group:123)
        const memberships = res.data.elements || [];

        // To get titles, LinkedIn usually requires an additional call to /v2/groups/{id}
        // Since that's intensive, we return the URNs and basic info we have.
        // If we want titles, we'd need to loop, but for now, let's just return the IDs.

        const groups = memberships.map((m: any) => ({
            id: m.group,
            role: m.role,
            state: m.membershipState
        }));

        return NextResponse.json({ groups });

    } catch (error: any) {
        console.error("[LinkedIn Groups API] Error:", error.response?.data || error.message);

        // Handle 403 gracefully - might mean app doesn't have group permissions
        if (error.response?.status === 403) {
            return NextResponse.json({
                error: "Insufficient permissions to fetch groups. Ensure your LinkedIn App has 'Community Management' products enabled.",
                code: 'PERMISSION_DENIED'
            }, { status: 403 });
        }

        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
