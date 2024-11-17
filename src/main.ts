import { Actor, ProxyConfigurationOptions } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { createGoogleHotelsRouter } from './routes.js';
import { GoogleHotelsOptions } from './scraper/options.js';
import { CONTENT_LANGUAGE_CODE, DEFAULT_MAX_REQUESTS_PER_CRAWL } from './constants.js';

interface Input extends GoogleHotelsOptions {
    proxyConfig: ProxyConfigurationOptions;
    maxRequestsPerCrawl: number;
}

// Initialize the Apify SDK
await Actor.init();

const input = await Actor.getInput<Input>() ?? {} as Input;

// validate inputs format
if (input.checkInDate.match(/^\d{4}-\d{2}-\d{2}$/) === null) {
    await Actor.exit('Invalid check-in date format. Use YYYY-MM-DD.', { exitCode: 1 });
}
if (input.checkOutDate.match(/^\d{4}-\d{2}-\d{2}$/) === null) {
    await Actor.exit('Invalid check-out date format. Use YYYY-MM-DD.', { exitCode: 1 });
}

const proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfig);
const {
    searchQuery,
    maxRequestsPerCrawl = DEFAULT_MAX_REQUESTS_PER_CRAWL,
} = input;

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    requestHandler: createGoogleHotelsRouter(input),
});

try {
    await crawler.run([`https://www.google.co.in/travel/search?q=${encodeURIComponent(searchQuery)}&hl=${CONTENT_LANGUAGE_CODE}`]);
} catch (error) {
    await Actor.exit({ exitCode: 1 });
}

// Exit successfully
await Actor.exit();
