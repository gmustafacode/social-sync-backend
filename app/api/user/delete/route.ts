import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import db from "@/lib/db"
import { apiResponse, handleApiError } from "@/lib/api-utils"

export async function DELETE() {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return apiResponse.unauthorized();
    }

    const userId = (session.user as any).id

    try {
        // Since we have 'onDelete: Cascade' in our schema, 
        // deleting the user will automatically delete all related data.
        await db.user.delete({
            where: { id: userId }
        })

        return apiResponse.success({ success: true })
    } catch (error) {
        return handleApiError(error);
    }
}
