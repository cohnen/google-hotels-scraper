import { LoadedRequest, PlaywrightCrawlingContext, Request } from 'crawlee';

export interface GoogleHotelItemData {
    url: string;
    googleId?: string;
    title: string;
    website?: string;
    address?: string;
    phone?: string;
    photos: string[];
    thumbnail?: string;
    rating: number;
    priceRange?: string;
    reviews: number;
    prices: { provider: string, price: number, link: string }[];
}

export const getHotelItemData = async <Context extends PlaywrightCrawlingContext>(ctx: Omit<Context, 'request'> & {
    request: LoadedRequest<Request>;
}): Promise<GoogleHotelItemData> => {
    const { page, log } = ctx;

    const title = await page.locator('h1[role="heading"]').last().innerText();
    const googleId = await page.locator('span[data-place-id]').first().getAttribute('data-place-id');
    const url = page.url();

    const [pricesTab, reviewsTab, aboutTab, photosTab] = await Promise.all([
        page.waitForSelector('div[id="prices"]'),
        page.waitForSelector('div[id="reviews"]'),
        page.waitForSelector('div[id="details"]'),
        page.waitForSelector('div[id="photos"]'),
    ]);

    await pricesTab.click();
    const pricesBtns = await page.locator('button[aria-label^="Visit site for"]').all();
    // const pricesBtns = await page.$$('button[aria-label^="Visit site for"]');
    const prices = (await Promise.all(pricesBtns.map(async (btn) => {
        const row = btn.locator('..').locator('..');
        const link = await row.locator('..').getAttribute('href');

        if (link != null) {
            try {
                const provider = await row.locator('div:nth-of-type(1) > div > span > span').first().innerText();

                const textPrice = await row.locator('div:nth-of-type(2) > span > span > span > span').first().innerText();
                const price = parseFloat(textPrice.replace(/[^0-9.]/g, ''));

                return { provider, price, link: `https://www.google.co.in/travel${link}` };
            } catch (e) {
                // some providers has multiple prices and structure is different of the others is different,
                // so we need to skip them and use the first (cheapest) price
                return null;
            }
        }

        return null;
    }))).filter((price, i, arr) => price !== null && arr.findIndex((o) => o?.provider === price.provider) === i) as GoogleHotelItemData['prices'];

    await reviewsTab.click();
    let reviewText: string | undefined;
    if (await page.locator('div[aria-label*="out of"][role="text"]').count()) {
        reviewText = await page.locator('div[aria-label*="out of"][role="text"]').first().getAttribute('aria-label') || undefined;
    }
    let rating = 0;
    let reviews = 0;
    if (reviewText) {
        rating = parseFloat(reviewText.substring(0, reviewText.indexOf('out')).trim());
        reviews = parseInt(reviewText.substring(reviewText.indexOf('from'))
            .replace('from', '')
            .replace('reviews', '')
            .replace(',', '')
            .trim(), 10);
    }

    await aboutTab.click();

    let address: string | undefined;
    if (await page.locator('span[aria-label*="hotel address is"]').count()) {
        address = await page.locator('span[aria-label*="hotel address is"]').getAttribute('href') || undefined;
    }
    let website: string | undefined;
    if (await page.locator('a[aria-label="Website"]').count()) {
        website = await page.locator('a[aria-label="Website"]').getAttribute('href') || undefined;
    }
    let phone: string | undefined;
    if (await page.locator('span[aria-label*="call this hotel"]').count()) {
        phone = await page.locator('span[aria-label*="call this hotel"]').innerText() || undefined;
    }

    await photosTab.click();
    await page.waitForTimeout(2000);
    const photosElements = await page.locator('span[id="photos"] img[alt*="Photo"]').all();
    const photos = (await Promise.all(photosElements.map(async (photo) => {
        const src = await photo.getAttribute('src');
        if (src !== null) {
            if (src.startsWith('//')) {
                return `https:${src}`;
            }
            return src;
        }
        return null;
    }))).filter((photo) => photo !== null) as string[];

    log.info(`Parsed detail (${title}) [${googleId}]`, { url: page.url() });

    const thumbnail = photos.length ? photos[0] : undefined;
    let priceRange: string | undefined;
    if (prices.length === 1) {
        priceRange = `${prices[0].price}`;
    } else if (prices.length > 1) {
        const minPrice = prices.reduce((min, p) => (p.price < min ? p.price : min), prices[0].price);
        const maxPrice = prices.reduce((max, p) => (p.price > max ? p.price : max), prices[0].price);
        priceRange = `${minPrice} - ${maxPrice}`;
    }

    return {
        thumbnail,
        url,
        title,
        googleId,
        website,
        address,
        phone,
        photos,
        rating,
        reviews,
        prices,
        priceRange,
    };
};
