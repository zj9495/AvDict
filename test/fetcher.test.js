// 为 Node 18 提供 Web API polyfill
import { beforeAll } from 'vitest';

beforeAll(() => {
    if (typeof global.File === 'undefined') {
        global.File = class File {
            constructor(bits, name, options = {}) {
                this.bits = bits;
                this.name = name;
                this.type = options.type || '';
                this.size = bits?.length || 0;
            }
        };
    }

    if (typeof global.FormData === 'undefined') {
        global.FormData = class FormData {
            constructor() {
                this.data = new Map();
            }
            append(key, value) {
                this.data.set(key, value);
            }
        };
    }
});

// =====================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('child_process', () => ({
    execSync: vi.fn(),
    spawnSync: vi.fn(),
}));

// Mock cache
vi.mock('../lib/cache.js', () => ({
    getCache: vi.fn().mockReturnValue(null),
    setCache: vi.fn(),
    getConfig: vi.fn().mockReturnValue({ session: 'mock_session' }),
}));

import { execSync } from 'child_process';
import { search } from '../lib/fetcher.js';

// 模拟 HTML 数据
const MOCK_JAVBUS_HTML = `
<html>
  <head><title>SSIS-001</title></head>
  <body>
    <div class="container">
      <div class="row">
        <h3>SSIS-001 测试标题</h3>
        <div class="screencap">
          <img src="https://example.com/cover.jpg" />
        </div>
        <div class="info">
          <p><span class="header">發行日期:</span> 2021-01-01</p>
          <p><span class="header">長度:</span> 150分鐘</p>
          <p><span class="header">導演:</span> <a>导演A</a></p>
          <p><span class="header">製作商:</span> <a>SOD Create</a></p>
          <p><span class="header">發行商:</span> <a>SOD</a></p>
          <p><span class="header">系列:</span> <a>系列A</a></p>
        </div>
        <span class="genre"><a>独占</a></span>
        <span class="genre"><a>美少女</a></span>
        <div class="star-name"><a>天使もえ</a></div>
      </div>
    </div>
  </body>
</html>
`;

const MOCK_404_HTML = `
<html>
  <head><title>404</title></head>
  <body></body>
</html>
`;

describe('fetcher.js', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('search：正常番号能返回结构完整的对象', async () => {
        execSync.mockReturnValue(Buffer.from(MOCK_JAVBUS_HTML));

        const result = await search('SSIS-001');

        expect(result).not.toBeNull();
        expect(result.id).toBe('SSIS-001');
        expect(result.source).toBe('JAVBUS');
        expect(result.actresses).toContain('天使もえ');
        expect(result.releaseDate).toBe('2021-01-01');
        expect(result.studio).toBe('SOD Create');
    });

    it('search：搜索结果为空时返回 null', async () => {
        execSync.mockReturnValue(Buffer.from(MOCK_404_HTML));

        const result = await search('INVALID-999');
        expect(result).toBeNull();
    });

    it('search：网络请求失败时返回 null', async () => {
        execSync.mockImplementation(() => {
            throw new Error('Network Error');
        });

        const result = await search('SSIS-001');
        expect(result).toBeNull();
    });

    it('search：返回对象包含所有预期字段', async () => {
        execSync.mockReturnValue(Buffer.from(MOCK_JAVBUS_HTML));

        const result = await search('SSIS-001');
        const expectedFields = [
            'id', 'title', 'actresses', 'actors',
            'releaseDate', 'duration', 'studio', 'label',
            'director', 'series', 'tags', 'coverUrl', 'score',
        ];

        expectedFields.forEach(field => {
            expect(result).toHaveProperty(field);
        });
    });
});