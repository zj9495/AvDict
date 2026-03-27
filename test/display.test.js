import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { display } from '../lib/display.js';

const MOCK_INFO = {
    id: 'SSIS-001',
    title: '测试标题',
    actresses: ['天使もえ'],
    actors: ['男优A'],
    releaseDate: '2021-01-01',
    duration: '120分钟',
    studio: 'SOD Create',
    label: 'SOD',
    director: '导演A',
    series: '系列A',
    tags: ['独占', '美少女'],
    coverUrl: 'https://example.com/cover.jpg',
    score: '4.5分',
    magnets: ['magnet:?xt=urn:btih:aaa111'],
};

describe('display.js', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('display：正常调用不抛出异常', () => {
        expect(() => display(MOCK_INFO)).not.toThrow();
    });

    it('display：输出内容包含番号', () => {
        display(MOCK_INFO);
        const allOutput = console.log.mock.calls.flat().join(' ');
        expect(allOutput).toContain('SSIS-001');
    });

    it('display：输出内容包含女优名', () => {
        display(MOCK_INFO);
        const allOutput = console.log.mock.calls.flat().join(' ');
        expect(allOutput).toContain('天使もえ');
    });

    it('display：raw 模式输出 JSON 字符串', () => {
        display(MOCK_INFO, true);
        const allOutput = console.log.mock.calls.flat().join(' ');
        expect(() => JSON.parse(allOutput)).not.toThrow();
        expect(JSON.parse(allOutput)).toHaveProperty('magnets');
    });

    it('display：空字段不影响正常输出', () => {
        const sparseInfo = { ...MOCK_INFO, actors: [], tags: [], coverUrl: '' };
        expect(() => display(sparseInfo)).not.toThrow();
    });

    it('display：showMagnet=true 时输出磁力链接区块', () => {
        display(MOCK_INFO, false, 'zh', true);
        const allOutput = console.log.mock.calls.flat().join(' ');
        expect(allOutput).toContain('磁力链接');
        expect(allOutput).toContain('magnet:?xt=urn:btih:aaa111');
    });

    it('display：showMagnet=true 且无磁链时输出提示', () => {
        display({ ...MOCK_INFO, magnets: [] }, false, 'zh', true);
        const allOutput = console.log.mock.calls.flat().join(' ');
        expect(allOutput).toContain('未找到磁力链接');
    });
});
