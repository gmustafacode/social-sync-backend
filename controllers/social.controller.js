import SocialAccount from "../models/socialAccount.model.js";
import User from "../models/user.model.js";

export const getConnectedAccounts = async (req, res) => {
    try {
        const userId = req.userId?.toString();
        if (!userId) return res.status(401).json({ message: "Unauthenticated" });
        const accounts = await SocialAccount.find({ userId }).lean();

        const normalized = accounts.map(acc => ({
            _id: acc._id,
            platform: acc.platform,
            platformUsername: acc.username || acc.name || acc.platformUserId || "Account",
            name: acc.name,
            email: acc.email,
            picture: acc.picture || acc.profileImage,
            isActive: true,
            connectedAt: acc.createdAt || new Date().toISOString()
        }));

        res.status(200).json(normalized);
    } catch (error) {
        console.error("getConnectedAccounts Error:", error);
        res.status(500).json({ message: "Failed to fetch accounts", error: error.message });
    }
};

export const disconnectAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId?.toString();

        // Support disconnect by MongoDB _id or platform name, but only for this user.
        let deleted = await SocialAccount.findOneAndDelete({ _id: id, userId });
        if (!deleted) {
            deleted = await SocialAccount.findOneAndDelete({ platform: id, userId });
        }

        res.status(deleted ? 200 : 404).json({ success: Boolean(deleted), message: deleted ? "Account disconnected" : "Account not found" });
    } catch (error) {
        res.status(500).json({ message: "Failed to disconnect", error: error.message });
    }
};
