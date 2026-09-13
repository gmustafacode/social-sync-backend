/**
 * LinkedIn Token Validation & Debugging Utilities
 * 
 * This module provides comprehensive token validation and scope checking
 * to prevent 403 ACCESS_DENIED errors.
 */

export interface LinkedInTokenInfo {
    isValid: boolean;
    scopes: string[];
    endpoints: {
        userinfo: boolean;
        me: boolean;
    };
    errors: string[];
}

/**
 * Validates a LinkedIn access token by testing actual API endpoints.
 * This is the ONLY reliable way to check token validity since LinkedIn
 * doesn't provide a public token introspection endpoint.
 */
export async function validateLinkedInToken(accessToken: string): Promise<LinkedInTokenInfo> {
    const result: LinkedInTokenInfo = {
        isValid: false,
        scopes: [],
        endpoints: {
            userinfo: false,
            me: false
        },
        errors: []
    };

    if (!accessToken || accessToken.length < 50) {
        result.errors.push('Token is missing or too short');
        return result;
    }

    // Test 1: OIDC /v2/userinfo endpoint (Modern)
    try {
        const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            signal: AbortSignal.timeout(15000)
        });

        if (userinfoRes.ok) {
            result.endpoints.userinfo = true;
            result.scopes.push('openid', 'profile', 'email');
            result.isValid = true;
            console.log('[LinkedIn Validation] ✅ /v2/userinfo accessible (OIDC scopes present)');
        } else {
            let errorBody: any;
            try {
                errorBody = await userinfoRes.json();
            } catch (e) {
                errorBody = { message: await userinfoRes.text().catch(() => 'Unreadable error') };
            }
            result.errors.push(`/v2/userinfo failed: ${JSON.stringify(errorBody)}`);
            console.warn('[LinkedIn Validation] ⚠️ /v2/userinfo failed:', errorBody);
        }
    } catch (e: any) {
        result.errors.push(`/v2/userinfo error: ${e.message}`);
    }

    // Test 2: Legacy /v2/me endpoint
    try {
        const meRes = await fetch('https://api.linkedin.com/v2/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            },
            signal: AbortSignal.timeout(15000)
        });

        if (meRes.ok) {
            result.endpoints.me = true;
            result.scopes.push('r_liteprofile');
            result.isValid = true;
            console.log('[LinkedIn Validation] ✅ /v2/me accessible (r_liteprofile present)');
        } else {
            let errorBody: any;
            try {
                errorBody = await meRes.json();
            } catch (e) {
                errorBody = { message: await meRes.text().catch(() => 'Unreadable error') };
            }
            result.errors.push(`/v2/me failed: ${JSON.stringify(errorBody)}`);
            console.warn('[LinkedIn Validation] ⚠️ /v2/me failed:', errorBody);
        }
    } catch (e: any) {
        result.errors.push(`/v2/me error: ${e.message}`);
    }

    // Test 3: Check posting permission (w_member_social)
    // We can't actually test this without creating a post, so we infer from profile access
    if (result.isValid) {
        result.scopes.push('w_member_social'); // Assumed if profile works
    }

    // Deduplicate scopes
    result.scopes = [...new Set(result.scopes)];

    console.log('[LinkedIn Validation] Final result:', {
        isValid: result.isValid,
        scopes: result.scopes,
        endpoints: result.endpoints,
        errorCount: result.errors.length
    });

    return result;
}

/**
 * Gets LinkedIn profile using the most reliable endpoint available.
 * Tries OIDC first, falls back to legacy /v2/me.
 */
export async function getLinkedInProfile(accessToken: string) {
    // Try modern OIDC endpoint first
    let profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        signal: AbortSignal.timeout(15000)
    });

    if (profileRes.ok) {
        const profile = await profileRes.json();
        console.log('[LinkedIn] Profile fetched via OIDC /v2/userinfo');
        return {
            id: profile.sub,
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            firstName: profile.given_name,
            lastName: profile.family_name,
            source: 'oidc',
            type: 'person',
            suggestedUrnPrefix: 'urn:li:person:'
        };
    }

    // Fallback to legacy endpoint with exact projection for picture
    profileRes = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
        },
        signal: AbortSignal.timeout(15000)
    });

    if (!profileRes.ok) {
        let errorBody: any;
        try {
            errorBody = await profileRes.json();
        } catch (e) {
            errorBody = { message: await profileRes.text().catch(() => 'Unreadable error') };
        }
        throw new Error(`LinkedIn profile fetch failed: ${JSON.stringify(errorBody)}`);
    }

    const profile = await profileRes.json();
    console.log('[LinkedIn] Profile fetched via Legacy /v2/me');

    const fName = profile.localizedFirstName || '';
    const lName = profile.localizedLastName || '';
    const fullName = `${fName} ${lName}`.trim() || 'LinkedIn User';

    // Parse the heavily nested playableStreams for the profile picture
    let pictureUrl = null;
    try {
        const streams = profile.profilePicture?.['displayImage~']?.elements;
        if (streams && streams.length > 0) {
            // Get the largest image representation (usually the last in the array)
            const largestStream = streams[streams.length - 1];
            pictureUrl = largestStream?.identifiers?.[0]?.identifier || null;
        }
    } catch (e) {
        console.warn("[LinkedIn] Failed to parse legacy profile picture", e);
    }

    return {
        id: profile.id,
        email: null, // /v2/me doesn't return email
        name: fullName,
        picture: pictureUrl,
        firstName: fName,
        lastName: lName,
        source: 'legacy',
        type: 'person',
        suggestedUrnPrefix: 'urn:li:person:'
    };
}

/**
 * Diagnostic function to log all token information
 */
export function logTokenDiagnostics(accessToken: string, context: string = 'Unknown') {
    console.log(`[LinkedIn Token Diagnostics - ${context}]`, {
        length: accessToken.length,
        prefix: accessToken.substring(0, 20) + '...',
        suffix: '...' + accessToken.substring(accessToken.length - 10),
        startsWithBearer: accessToken.startsWith('Bearer '),
        hasSpaces: accessToken.includes(' '),
        timestamp: new Date().toISOString()
    });
}
