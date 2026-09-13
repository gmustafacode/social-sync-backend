/**
 * Platform Guard - Enforces "One Account Per Platform Per User" Rule
 * 
 * This module provides validation logic to ensure users cannot connect
 * multiple accounts of the same platform (e.g., multiple LinkedIn accounts).
 * 
 * Business Rules:
 * ✅ ALLOWED: User can connect LinkedIn + YouTube + Instagram + TikTok
 * ❌ BLOCKED: User cannot connect LinkedIn Account A + LinkedIn Account B
 */

import db from './db';

export interface PlatformGuardResult {
    allowed: boolean;
    reason?: string;
    existingAccount?: {
        id: string;
        platformAccountId: string | null;
        metadata: string | null;
        connectedAt: Date;
        status: string;
    };
}

export class PlatformGuard {
    /**
     * Checks if a user can attach a new account for the given platform.
     * 
     * @param userId - The user's ID
     * @param platform - The platform name (e.g., 'linkedin', 'youtube')
     * @returns Object with allowed status and optional reason/existing account
     * 
     * @example
     * const guard = await PlatformGuard.canAttachPlatform(userId, 'linkedin');
     * if (!guard.allowed) {
     *   throw new Error(guard.reason);
     * }
     */
    static async canAttachPlatform(
        userId: string,
        platform: string
    ): Promise<PlatformGuardResult> {

        const existingAccount = await db.socialAccount.findUnique({
            where: {
                user_platform_unique: {
                    userId,
                    platform
                }
            },
            select: {
                id: true,
                platformAccountId: true,
                metadata: true,
                connectedAt: true,
                status: true
            }
        });

        if (existingAccount) {
            // Parse metadata to get account name/username
            let accountName = platform;
            try {
                const meta = JSON.parse(existingAccount.metadata || '{}');
                accountName = meta.username || meta.name || platform;
            } catch (e) {
                // Ignore parsing errors
            }

            return {
                allowed: false,
                reason: `You already have a ${this.getPlatformDisplayName(platform)} account connected (${accountName}). Please disconnect it first to connect a different account.`,
                existingAccount
            };
        }

        return { allowed: true };
    }

    /**
     * Gets all connected platforms for a user.
     * 
     * @param userId - The user's ID
     * @returns Array of platform names
     * 
     * @example
     * const platforms = await PlatformGuard.getConnectedPlatforms(userId);
     * // ['linkedin', 'youtube', 'instagram']
     */
    static async getConnectedPlatforms(userId: string): Promise<string[]> {
        const accounts = await db.socialAccount.findMany({
            where: {
                userId,
                status: { not: 'revoked' }
            },
            select: { platform: true }
        });

        return accounts.map(a => a.platform);
    }

    /**
     * Checks if a specific platform is connected for a user.
     * 
     * @param userId - The user's ID
     * @param platform - The platform name
     * @returns True if connected, false otherwise
     */
    static async isPlatformConnected(userId: string, platform: string): Promise<boolean> {
        const count = await db.socialAccount.count({
            where: {
                userId,
                platform,
                status: { not: 'revoked' }
            }
        });

        return count > 0;
    }

    /**
     * Gets the account for a specific platform.
     * 
     * @param userId - The user's ID
     * @param platform - The platform name
     * @returns The social account or null if not found
     */
    static async getPlatformAccount(userId: string, platform: string) {
        return await db.socialAccount.findUnique({
            where: {
                user_platform_unique: {
                    userId,
                    platform
                }
            }
        });
    }

    /**
     * Gets a user-friendly display name for a platform.
     * 
     * @param platform - The platform identifier
     * @returns Display name
     */
    static getPlatformDisplayName(platform: string): string {
        const displayNames: Record<string, string> = {
            'linkedin': 'LinkedIn',
            'youtube': 'YouTube',
            'instagram': 'Instagram',
            'tiktok': 'TikTok',
            'x': 'X (Twitter)',
            'facebook': 'Facebook',
            'reddit': 'Reddit',
            'medium': 'Medium'
        };

        return displayNames[platform.toLowerCase()] || platform;
    }

    /**
     * Validates that a platform name is supported.
     * 
     * @param platform - The platform name to validate
     * @returns True if supported
     */
    static isSupportedPlatform(platform: string): boolean {
        const supported = [
            'linkedin',
            'youtube',
            'instagram',
            'tiktok',
            'x',
            'facebook',
            'reddit',
            'medium',
            'google'
        ];

        return supported.includes(platform.toLowerCase());
    }

    /**
     * Extracts platform-specific account ID from profile data.
     * 
     * @param platform - The platform name
     * @param profile - The profile data from OAuth
     * @returns The platform-specific account ID
     */
    static extractPlatformAccountId(platform: string, profile: any): string {
        switch (platform.toLowerCase()) {
            case 'linkedin':
                return profile.sub || profile.id;
            case 'youtube':
            case 'google':
                return profile.id || profile.sub;
            case 'instagram':
                return profile.id;
            case 'tiktok':
                return profile.open_id || profile.union_id;
            case 'x':
                return profile.data?.id || profile.id;
            case 'facebook':
                return profile.id;
            case 'reddit':
                return profile.name;
            case 'medium':
                return profile.data?.id || profile.id;
            default:
                return profile.id || profile.sub || 'unknown';
        }
    }
}
