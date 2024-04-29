import puppeteer from '@/utils/puppeteer';
import { MBASIC_DOMAIN, W3_DOMAIN } from '@/routes/facebook/constant';
import { Route } from '@/types';

import { load } from 'cheerio';
import utils from './utils';

export const route: Route = {
    path: '/groups/:name/:routeParams?',
    categories: ['social-media'],
    example: '/facebook/groups/oculusquest2',
    parameters: { name: 'Group name in URL' },
    features: {
        requireConfig: [
            {
                name: 'FACEBOOK_COOKIES',
                optional: false,
                description: 'Please see above for details.',
            },
        ],
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['facebook.com/groups/:name'],
        },
    ],
    name: 'Group',
    maintainers: ['kennyfong19931'],
    handler,
    description: `::: tip

    The sorting for Facebook group is 'Most Relevant Posts', which may not be what you want.
    :::`,
};

async function handler(ctx) {
    const { name } = ctx.req.param();
    const routeParams = Object.fromEntries(new URLSearchParams(ctx.req.param('routeParams')));
    const url = `https://${MBASIC_DOMAIN}/groups/${name}`;

    const browser = await puppeteer();
    const response = await utils.facebookGot(browser, url);
    const $ = load(response);
    const list = $('#m_group_stories_container > section > article');
    const items = await Promise.all(list.map((i, item) => utils.parseItem($, browser, item, routeParams))).then((items) => items.filter((item) => item.pubDate.toString() !== 'Invalid Date') /* remove post without date */);

    await browser.close();

    return {
        title: $('head title').text().split('_')[0],
        description: $('#m-timeline-cover-section div._52ja').text(),
        link: `https://${W3_DOMAIN}/${name}`,
        item: items,
    };
}
