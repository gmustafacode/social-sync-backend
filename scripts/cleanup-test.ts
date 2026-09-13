import db from '../lib/db';

async function main() {
    try {
        const deletedPosts = await db.scheduledPost.deleteMany({
            where: {
                contentText: { contains: 'Backend Worker Test' }
            }
        });
        console.log(`Deleted ${deletedPosts.count} test scheduled posts.`);

        const deletedContent = await db.contentQueue.deleteMany({
            where: {
                title: 'Worker Test Title'
            }
        });
        console.log(`Deleted ${deletedContent.count} test content records.`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

main();
