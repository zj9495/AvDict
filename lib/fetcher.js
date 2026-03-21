import { execSync } from 'child_process';
import * as cheerio from 'cheerio';
import { getCache, setCache, getConfig } from './cache.js';
import chalk from 'chalk';

// ─── 通用请求函数（JAVBUS / JavLibrary 使用）────────────
function fetchHtml(url, cookie = '') {
    const cookieHeader = cookie ? `-H "Cookie: ${cookie}"` : '';
    const result = execSync(
        `curl -sL "${url}" \
      -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" \
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
      -H "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8" \
      ${cookieHeader}`,
        { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }
    );
    return result.toString();
}

// ─── 数据源一：JAVBUS ────────────────────────────────────
function searchJavbus(id) {
    try {
        const url = `https://www.javbus.com/${id}`;
        const html = fetchHtml(url);
        const $ = cheerio.load(html);

        if ($('title').text().includes('404') || !$('.container .row').length) {
            return null;
        }

        const result = {
            id,
            source: 'JAVBUS',
            title: $('h3').first().text().trim(),
            actresses: [],
            actors: [],
            releaseDate: '',
            duration: '',
            studio: '',
            label: '',
            director: '',
            series: '',
            tags: [],
            coverUrl: $('.screencap img').attr('src') || '',
            score: '',
        };

        $('.info p').each((_, el) => {
            const text = $(el).text().trim();
            const label = $(el).find('span.header').text().trim();
            if (/發行日期|发行日期/.test(label)) {
                result.releaseDate = text.replace(label, '').trim();
            } else if (/長度|长度/.test(label)) {
                result.duration = text.replace(label, '').trim();
            } else if (/導演|导演/.test(label)) {
                result.director = $(el).find('a').text().trim();
            } else if (/製作商|制作商/.test(label)) {
                result.studio = $(el).find('a').text().trim();
            } else if (/發行商|发行商/.test(label)) {
                result.label = $(el).find('a').text().trim();
            } else if (/系列/.test(label)) {
                result.series = $(el).find('a').text().trim();
            }
        });

        $('span.genre a').each((_, el) => {
            const tag = $(el).text().trim();
            if (tag) result.tags.push(tag);
        });

        $('.star-name a').each((_, el) => {
            const name = $(el).text().trim();
            if (name) result.actresses.push(name);
        });

        return result.title ? result : null;
    } catch {
        return null;
    }
}

// ─── 数据源二：JavLibrary ────────────────────────────────
function searchJavlibrary(id) {
    try {
        const searchUrl = `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodeURIComponent(id)}`;
        const searchHtml = fetchHtml(searchUrl);
        const $ = cheerio.load(searchHtml);

        let detailHtml = searchHtml;
        const firstResult = $('.videos .video a').first();
        if (firstResult.length) {
            const detailPath = firstResult.attr('href');
            detailHtml = fetchHtml(`https://www.javlibrary.com/cn/${detailPath}`);
        }

        const $d = cheerio.load(detailHtml);
        if (!$d('#video_id .text').length) return null;

        const foundId = $d('#video_id .text').text().trim().toUpperCase();
        if (foundId !== id.toUpperCase()) return null;

        const result = {
            id,
            source: 'JavLibrary',
            title: $d('#video_title h3').text().trim(),
            actresses: [],
            actors: [],
            releaseDate: $d('#video_date .text').text().trim(),
            duration: $d('#video_length .text').text().trim(),
            studio: $d('#video_maker .text a').text().trim(),
            label: $d('#video_label .text a').text().trim(),
            director: $d('#video_director .text a').text().trim(),
            series: $d('#video_series .text a').text().trim(),
            tags: [],
            coverUrl: $d('#video_jacket_img').attr('src') || '',
            score: $d('#video_review .score').text().trim(),
        };

        $d('#video_genres .genre a').each((_, el) => {
            const tag = $d(el).text().trim();
            if (tag) result.tags.push(tag);
        });

        $d('#video_cast .cast .star a').each((_, el) => {
            const name = $d(el).text().trim();
            if (name) result.actresses.push(name);
        });

        return result.title ? result : null;
    } catch {
        return null;
    }
}

// ─── 数据源三：JAVDB（需要Cookie，仅Linux/Mac）──────────
async function searchJavdb(id) {
    try {
        const config = getConfig();
        if (!config.session) return null;

        // Windows上Cloudflare封锁了非OpenSSL的TLS请求，跳过
        if (process.platform === 'win32') return null;

        const session = decodeURIComponent(config.session);
        const cookie = `locale=zh; over18=1; _jdb_session=${session}`;

        function fetchJavdbHtml(url) {
            return execSync(
                `curl -sL "${url}" \
                  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" \
                  -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
                  -H "Accept-Language: zh-CN,zh;q=0.9" \
                  -H "Cookie: ${cookie}"`,
                { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }
            ).toString();
        }

        const searchUrl = `https://javdb.com/search?q=${encodeURIComponent(id)}&f=all`;
        const searchHtml = fetchJavdbHtml(searchUrl);

        const $ = cheerio.load(searchHtml);
        let detailPath = null;

        $('.movie-list .item a.box').each((_, el) => {
            const foundId = $(el).find('.video-title strong').text().trim().toUpperCase();
            const normalize = s => s.replace(/[-_]/g, '');
            if (normalize(foundId) === normalize(id.toUpperCase())) {
                detailPath = $(el).attr('href');
                return false;
            }
        });

        if (!detailPath) detailPath = $('.movie-list .item a.box').first().attr('href');
        if (!detailPath) return null;

        // 详情页最多重试 3 次，每次间隔 2 秒
        let detailHtml = '';
        for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            detailHtml = fetchJavdbHtml(`https://javdb.com${detailPath}`);
            if (detailHtml.length > 1000) break;
        }

        if (detailHtml.length < 1000) return null;
        return parseJavdb(detailHtml, id);
    } catch {
        return null;
    }
}

function parseJavdb(html, queryId) {
    const $ = cheerio.load(html);
    const result = {
        id: queryId,
        source: 'JAVDB',
        title: $('strong.current-title').text().trim(),
        actresses: [],
        actors: [],
        releaseDate: '',
        duration: '',
        studio: '',
        label: '',
        director: '',
        series: '',
        tags: [],
        coverUrl: $('.video-cover img').attr('src') || '',
        score: $('.score .value').first().text().trim(),
    };

    $('.movie-panel-info .panel-block').each((_, el) => {
        const label = $(el).find('strong').first().text().replace(/：|:/g, '').trim();
        const valueEl = $(el).find('.value');
        const valueText = valueEl.text().trim();

        if (/日期/.test(label)) {
            const m = valueText.match(/\d{4}-\d{2}-\d{2}/);
            result.releaseDate = m ? m[0] : valueText;
        } else if (/時長|时长/.test(label)) {
            result.duration = valueText;
        } else if (/導演|导演/.test(label)) {
            result.director = valueText;
        } else if (/片商/.test(label)) {
            result.studio = valueText;
        } else if (/發行商|发行商/.test(label)) {
            result.label = valueText;
        } else if (/系列/.test(label)) {
            result.series = valueText;
        } else if (/類別|类别/.test(label)) {
            valueEl.find('a').each((_, a) => {
                const t = $(a).text().trim();
                if (t) result.tags.push(t);
            });
        } else if (/演員|演员/.test(label)) {
            valueEl.find('a').each((_, a) => {
                const name = $(a).text().trim();
                if (name) result.actresses.push(name);
            });
        } else if (/男優|男优/.test(label)) {
            valueEl.find('a').each((_, a) => {
                const name = $(a).text().trim();
                if (name) result.actors.push(name);
            });
        }
    });

    return result.title ? result : null;
}

// ─── 主入口：依次尝试三个数据源 ─────────────────────────
export async function search(id) {
    // FC2 格式识别：031926-100 → 031926_100（JAVDB 存储格式）
    let searchId = id;
    if (/^\d{5,6}-\d+$/.test(id)) {
        searchId = id.replace(/-/g, '_');  // 全局替换，更安全
        console.log(chalk.gray(`  识别为FC2格式的车牌号: ${id}`));
    }

    const cached = getCache(id);
    if (cached) return cached;

    const MAX_RETRY = 3;

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        let result = null;

        result = searchJavbus(searchId);
        if (result) { setCache(id, result); return result; }

        result = searchJavlibrary(searchId);
        if (result) { setCache(id, result); return result; }

        result = await searchJavdb(searchId);
        if (result) { setCache(id, result); return result; }

        if (attempt < MAX_RETRY) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Windows 用户提示
    if (process.platform === 'win32') {
        process.stderr.write(chalk.gray('  温馨提示: 此车牌号需要JAVDB数据源，Windows暂不支持~\n'));
    }

    return null;
}