
const Parser = require('rss-parser');
const parser = new Parser();

async function testRSS() {
    const url = 'https://feeds.feedburner.com/TechCrunch/';
    console.log(`Testing RSS fetch from ${url}...`);
    try {
        const feed = await parser.parseURL(url);
        console.log(`Successfully fetched ${feed.items.length} items from ${feed.title}`);
        if (feed.items.length > 0) {
            console.log("Latest Title:", feed.items[0].title);
            console.log("Snippet:", feed.items[0].contentSnippet || feed.items[0].content);
        }
    } catch (error) {
        console.error("RSS Fetch Failed:", error);
    }
}

testRSS();
