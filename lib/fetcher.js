import { execSync } from 'child_process';
import * as cheerio from 'cheerio';
import { getCache, setCache } from './cache.js';

const SESSION = decodeURIComponent('wJkH2678EN3cZzzL2Pqbyr158quff0CaGzuh5hRxUXXADcKOQm1zKdOnlwow3wDfL5AX2NeKne52BgUZT6JpBGp5prKgUmKyBReopEABv30rItmWnxowjJ04Mki%2BO0jQ3OO%2F4F2BYE7TTZ8GlgpA3kuesTAsX8bAcL0HqWF4LDRdMeo9JYqzDn%2FoPAUFxnmwXBieXtMXqCP8JnudI2vQ44jtIhFRvSrzf832gRMi7STwMG7K8O9%2BH3AoJfMKbuBomnLMFuBNBbPbB3SShbi3SBja8bX8nudBILUX0ZiJtD%2FEOl%2BN3r6dVPw5--do%2Bi7mvLi5xyZ0HZ--gZT%2Fl7%2BX9Vr3GjRNK7FXOw%3D%3D');

const COOKIE = `list_mode=h; theme=auto; locale=zh; over18=1; _jdb_session=${SESSION}`;
const BASE_URL = 'https://javdb.com';

function fetchHtml(url) {
    const result = execSync(
        `curl -sL "${url}" \
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" \
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \
      -H "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8" \
      -H "Cookie: ${COOKIE}"`,
        { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }
    );
    return result.toString();
}

export async function search(id) {
    const cached = getCache(id);
    if (cached) return cached;

    const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(id)}&f=all`;
    const searchHtml = fetchHtml(searchUrl);
    const $ = cheerio.load(searchHtml);

    const firstResult = $('.movie-list .item a').first();
    if (!firstResult.length) return null;

    const detailPath = firstResult.attr('href');
    if (!detailPath) return null;

    const detailUrl = `${BASE_URL}${detailPath}`;
    const detailHtml = fetchHtml(detailUrl);
    const result = parseDetail(detailHtml, id);

    setCache(id, result);
    return result;
}

function parseDetail(html, queryId) {
    const $ = cheerio.load(html);

    const result = {
        id: queryId,
        title: '',
        actresses: [],
        actors: [],
        releaseDate: '',
        duration: '',
        studio: '',
        label: '',
        director: '',
        series: '',
        tags: [],
        coverUrl: '',
        score: '',
    };

    result.title = $('h2.title strong.current-title').text().trim() ||
        $('h2.title').text().trim();
    result.coverUrl = $('.video-cover img').attr('src') || '';
    result.score = $('.score .value').first().text().trim();

    $('.movie-panel-info .panel-block').each((_, el) => {
        const label = $(el).find('strong').text().trim().replace(':', '');
        const valueEl = $(el).find('.value');

        switch (true) {
            case /日期|發行|发行/.test(label):
                result.releaseDate = valueEl.text().trim();
                break;
            case /時長|时长|分鐘|分钟/.test(label):
                result.duration = valueEl.text().trim();
                break;
            case /導演|导演/.test(label):
                result.director = valueEl.text().trim();
                break;
            case /片商|制作|製作/.test(label):
                result.studio = valueEl.text().trim();
                break;
            case /發行商|发行商/.test(label):
                result.label = valueEl.text().trim();
                break;
            case /系列/.test(label):
                result.series = valueEl.text().trim();
                break;
            case /類別|类别|genre/i.test(label):
                valueEl.find('a').each((_, a) => result.tags.push($(a).text().trim()));
                break;
            case /演員|演员|女優|女优/.test(label):
                valueEl.find('a').each((_, a) => {
                    const name = $(a).text().trim();
                    if (name) result.actresses.push(name);
                });
                break;
            case /男優|男优/.test(label):
                valueEl.find('a').each((_, a) => {
                    const name = $(a).text().trim();
                    if (name) result.actors.push(name);
                });
                break;
        }
    });

    return result;
}