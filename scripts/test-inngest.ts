
import { inngest } from "../lib/inngest/client";

async function testInngest() {
    console.log("Sending test/hello.world event to Inngest...");

    try {
        const result = await inngest.send({
            name: "test/hello.world",
            data: {
                email: "test@example.com"
            }
        });

        console.log("Event sent successfully:", result);
        console.log("Check the Inngest Dev Server at http://localhost:8288 to see the run.");
    } catch (error) {
        console.error("Failed to send event:", error);
    }
}

testInngest();
