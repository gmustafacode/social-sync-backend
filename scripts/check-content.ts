import db from '../lib/db'

async function main() {
    const count = await db.contentQueue.count()
    console.log(`Total items in ContentQueue: ${count}`)

    const pendingCount = await db.contentQueue.count({
        where: { status: 'pending' }
    })
    console.log(`Pending items: ${pendingCount}`)

    const ingestedLogs = await db.ingestionLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    })
    console.log('Recent Ingestion Logs:', JSON.stringify(ingestedLogs, null, 2))
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        // Shared db instance
    })
