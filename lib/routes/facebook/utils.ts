import { config } from '@/config';
import { MBASIC_DOMAIN, W3_DOMAIN } from '@/routes/facebook/constant';
import ConfigNotFoundError from '@/errors/types/config-not-found';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import md5 from '@/utils/md5';
import { parseDate, parseRelativeDate } from '@/utils/parse-date';
import { constructCookieArray } from '@/utils/puppeteer-utils';
import { queryToBoolean } from '@/utils/readable-social';
import timezone from '@/utils/timezone';

import dayjs from 'dayjs';
import queryString from 'query-string';
import { Cookie } from 'tough-cookie';
import { CheerioAPI } from 'cheerio';
import { Browser } from 'puppeteer';

const facebookGot = (browser: Browser, url: string) => {
    if (!config.facebook.cookie) {
        throw new ConfigNotFoundError('Facebook cookie is not configured');
    }
    const jsonCookie = Object.fromEntries(
        config.facebook.cookie
            .split(';')
            .map((c) => Cookie.parse(c)?.toJSON())
            .map((c) => [c?.key, c?.value])
    );
    if (!jsonCookie || !jsonCookie.c_user || !jsonCookie.xs) {
        throw new ConfigNotFoundError('Facebook cookie is not valid');
    }

    const linkObj = queryString.parseUrl(url);
    url = queryString.stringifyUrl({ url: linkObj.url, query: { ...linkObj.query, locale: 'en_US' } });

    return cache.tryGet(`facebook_${md5(url)}`, async () => {
        const page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            request.resourceType() === 'document' || request.resourceType() === 'script' ? request.continue() : request.abort();
        });
        const cookies = constructCookieArray(config.facebook.cookie, '.facebook.com');
        await page.setCookie(...cookies);
        logger.http(`Requesting ${url}`);
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
        });

        const response = await page.evaluate(() => document.documentElement.innerHTML);
        await page.close();

        return response;
    });
};

const parseItem = async ($: CheerioAPI, browser: Browser, html: string | Record<string, any> | null, routeParams: { [p: string]: string }, link?: string) => {
    const item = $(html);
    const postContent = item.find('div[data-ft="{\\"tn\\":\\"*s\\"}"] > div:first-child');
    const multimediaContent = item.find('div[data-ft="{\\"tn\\":\\"H\\"}"]');
    const lastHyperlink = postContent.find('a:last');
    if ('More' === lastHyperlink.text() && lastHyperlink.attr('href')?.startsWith('/story.php')) {
        const link = trimStoryLink('https://' + MBASIC_DOMAIN + lastHyperlink.attr('href'));
        const detailHtml = await facebookGot(browser, link);
        return parseItem($, browser, detailHtml, routeParams, link);
    }

    const author = item.find('header > h3 > span > strong > a:first').text();
    const title = postContent.text();

    let description = (queryToBoolean(routeParams.textOnly) ? postContent.text() : postContent.html()) + '<br/>';
    if (queryToBoolean(routeParams.textOnly)) {
        description += multimediaContent.find('a[aria-label!=""]').attr('aria-label') ?? '';
        description += multimediaContent.find('a > img[alt][alt!=""]').attr('alt') ?? '';
    } else {
        description += multimediaContent.html();
    }

    let pubDate;
    const dateStr = item.find('footer[data-ft="{\\"tn\\":\\"*W\\"}"] > div:first-child > abbr').text();
    if (dateStr.includes(' at ')) {
        const dateTimeArray = dateStr.split(' at ');
        if ('Yesterday' === dateTimeArray[0]) {
            // for pattern 'Yesterday at 07:30'
            pubDate = timezone(parseRelativeDate(`${dateTimeArray[0]} ${dateTimeArray[1]}`));
        } else {
            // for pattern '04 April at 07:30' or '04 April 2020 at 07:30'
            const dateTimeStr = dateTimeArray[0].split(' ').length === 2 ? `${dateTimeArray[0]} ${dayjs().year()} ${dateTimeArray[1]}` : `${dateTimeArray[0]} ${dateTimeArray[1]}`;
            pubDate = timezone(parseDate(dateTimeStr));
        }
    } else {
        // for pattern '1 min(s)' or '5 hr(s)'
        pubDate = timezone(parseRelativeDate(dateStr + ' ago'));
    }
    if (link) {
        link = link.replace(MBASIC_DOMAIN, W3_DOMAIN);
    } else {
        const fullLink = item.find('footer[data-ft="{\\"tn\\":\\"*W\\"}"] > div:nth-child(2) > a:first').attr('href');
        if (fullLink) {
            if (fullLink.startsWith('/story.php')) {
                link = trimStoryLink('https://' + W3_DOMAIN + fullLink);
            }
            if (/mbasic.facebook.com\/groups\/\w*\/permalink\/\d*/.test(fullLink)) {
                link = trimStoryLink(fullLink.replace(MBASIC_DOMAIN, W3_DOMAIN));
            }
        }
    }

    return {
        title,
        description,
        author,
        pubDate,
        link,
    };
};

// shorten link by remove tracking query params
const trimStoryLink = (url) => {
    const linkObj = queryString.parseUrl(url);
    return queryString.stringifyUrl({ url: linkObj.url, query: { id: linkObj.query.id, story_fbid: linkObj.query.story_fbid, fbid: linkObj.query.fbid } });
};

export default {
    facebookGot,
    parseItem,
};
