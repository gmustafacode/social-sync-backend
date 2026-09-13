import db from '../lib/db';
import { inngest } from '../lib/inngest/client';

async function testLinkedInPublish() {
    console.log("Seeding a new LinkedIn post for Inngest testing...");

    const user = await db.user.findFirst();
    const sa = await db.socialAccount.findUnique({
        where: { id: '03d1fe5d-e6ed-4146-b6a3-ad58f5a999ec' } // Using the one from previous output
    });

    if (!user || !sa) {
        console.log("User or SocialAccount not found.");
        return;
    }

    const post = await db.linkedInPost.create({
        data: {
            userId: user.id,
            socialAccountId: sa.id,
            description: "Testing Inngest Publish Flow at " + new Date().toISOString(),
            targetType: 'FEED',
            status: 'DRAFT', // Function allows DRAFT if manually triggered
            visibility: 'PUBLIC'
        }
    });

    console.log(`Created LinkedInPost: ${post.id}`);

    console.log("Sending linkedin/post.publish event...");
    await inngest.send({
        name: "linkedin/post.publish",
        data: {
            postId: post.id
        }
    });

    console.log("Event sent. Check Inngest logs.");
    process.exit(0);
}

testLinkedInPublish();
