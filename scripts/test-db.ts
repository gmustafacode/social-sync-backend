import { PrismaClient } from '../lib/generated/prisma'

const prisma = new PrismaClient()

async function main() {
    try {
        const count = await prisma.user.count()
        console.log("Connect successful. User count:", count)
    } catch (e) {
        console.error("Connection failed:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
