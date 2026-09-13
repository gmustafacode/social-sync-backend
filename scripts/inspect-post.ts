import { PrismaClient } from '../lib/generated/prisma'

const db = new PrismaClient()

async function inspect() {
    const post = await db.linkedInPost.findUnique({
        where: { id: '58d8cc33-3fe1-4c0e-a51d-cfdd94bd1419' }
    });

    if (!post) {
        console.log("Post not found");
        return;
    }

    console.log("Post Details:");
    console.log("Description:", post.description);
    console.log("Status:", post.status);
    console.log("Title:", post.title);
    console.log("PostType:", post.postType);
}

inspect()
    .catch(console.error)
    .finally(() => db.$disconnect());
