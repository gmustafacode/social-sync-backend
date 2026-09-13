
const axios = require('axios');
require('dotenv').config();

async function testNews() {
    const apiKey = process.env.NEWS_API_KEY;
    console.log("Testing NewsAPI with key:", apiKey ? "Present" : "Missing");
    try {
        const response = await axios.get('https://newsapi.org/v2/top-headlines', {
            params: {
                category: 'technology',
                language: 'en',
                apiKey
            }
        });
        console.log(`Successfully fetched ${response.data.articles.length} news items.`);
        if (response.data.articles.length > 0) {
            console.log("Latest News:", response.data.articles[0].title);
        }
    } catch (error) {
        console.error("NewsAPI Failed:", error.response?.data || error.message);
    }
}

testNews();
