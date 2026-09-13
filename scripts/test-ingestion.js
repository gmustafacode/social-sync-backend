
const { fetchRSS } = require('../lib/ingestion/connectors/rss');
const { processIngestedContent } = require('../lib/ingestion/processor');
const { PrismaClient } = require('@prisma/client');

// Mocking environment variables if needed or ensuring they are loaded
require('dotenv').config();

const prisma = new PrismaClient();

async function testIngestion() {
    console.log("Starting manual ingestion test...");

    try {
        const source = 'rss';
        const url = 'https://feeds.feedburner.com/TechCrunch/';
        console.log(`Fetching from ${url}...`);

        const items = await fetchRSS(url);
        console.log(`Fetched ${items.length} items.`);

        if (items.length > 0) {
            console.log("Sample item title:", items[0].title);
            console.log("Processing items...");
            const result = await processIngestedContent(source, items);
            console.log("Ingestion result:", JSON.stringify(result, null, 2));
        } else {
            console.log("No items fetched. Check internet connection or RSS URL.");
        }
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testIngestion();
