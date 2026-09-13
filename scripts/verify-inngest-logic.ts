function simulateInngest(event: any) {
    const isCron = !event.name || event.name === "inngest/scheduled.timer";
    const now = event.ts ? new Date(event.ts) : new Date();

    console.log(`--- Simulation ---`);
    console.log(`Event Name: ${event.name}`);
    console.log(`Event TS: ${event.ts}`);
    console.log(`Resulting 'isCron': ${isCron}`);
    console.log(`Resulting 'now': ${now.toISOString()}`);
}

console.log("Testing V3 Cron Event:");
simulateInngest({
    name: "inngest/scheduled.timer",
    data: { cron: "*/1 * * * *", scheduler: "cron-queue" },
    ts: 1771757160000,
    v: "1"
});

console.log("\nTesting Legacy Cron Event (No name):");
simulateInngest({
    data: {},
    ts: 1771757220000
});

console.log("\nTesting Real Event (Not cron):");
simulateInngest({
    name: "linkedin/post.publish",
    data: { postId: '123' },
    ts: Date.now()
});
