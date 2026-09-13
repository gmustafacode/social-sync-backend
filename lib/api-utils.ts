
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccessResponse<T> = T;
export type ApiErrorResponse = {
    error: string;
    details?: any;
    code?: string;
};

/**
 * Standardized API Response Helper
 */
export const apiResponse = {
    success: <T>(data: T, status: number = 200) => {
        return NextResponse.json(data, { status });
    },

    error: (message: string, status: number = 500, details?: any, code?: string) => {
        return NextResponse.json({
            error: message,
            details,
            code
        }, { status });
    },

    unauthorized: (message: string = "Unauthorized") => {
        return NextResponse.json({ error: message }, { status: 401 });
    },

    forbidden: (message: string = "Forbidden") => {
        return NextResponse.json({ error: message }, { status: 403 });
    },

    notFound: (message: string = "Resource not found") => {
        return NextResponse.json({ error: message }, { status: 404 });
    }
};

/**
 * Global Error Handler for API Routes
 */
export function handleApiError(error: any) {
    if (error instanceof ZodError) {
        return apiResponse.error(
            "Validation failed",
            400,
            error.issues.map((e) => ({
                path: e.path.join('.'),
                message: e.message
            }))
        );
    }

    console.error("[API Error Handler]:", error);

    // Prisma P2002: Unique constraint violation (e.g. duplicate sourceUrl)
    if (error.code === 'P2002') {
        const target = error.meta?.target;
        return apiResponse.error(`Conflict: A record with this ${target || 'value'} already exists.`, 409);
    }

    // Malformed JSON check (SyntaxError from req.json)
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return apiResponse.error("Invalid JSON payload", 400);
    }

    // Default 500 Error
    const message = process.env.NODE_ENV === "development" ? error.message : "Internal server error";
    return apiResponse.error(message, 500);
}
