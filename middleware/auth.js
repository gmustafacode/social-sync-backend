import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Unauthenticated" });

        const decodedData = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decodedData?.id || decodedData?._id || decodedData?.userId;
        if (!userId) return res.status(401).json({ message: "Unauthenticated" });
        req.userId = userId.toString();
        next();
    } catch (error) {
        res.status(401).json({ message: "Token expired or invalid", error: error.message });
    }
};

export default authMiddleware;
