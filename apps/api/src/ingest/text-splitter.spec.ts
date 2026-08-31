import type { AppConfig } from '../config';
import { splitContent } from './text-splitter';

// P4-5 验证：给定样例文档，切片数与序号可预期、可断言。
// 测试不经过 Nest 容器，直接以默认值构造配置（CHUNK_SIZE=500 / CHUNK_OVERLAP=50）。
const defaultConfig = {
  uploadMaxBytes: 2097152,
  chunkSize: 500,
  chunkOverlap: 50,
  ingestTimeoutMs: 60000,
  embeddingDim: 768,
  llm: { baseUrl: '', apiKey: '', chatModel: '' },
  embed: { baseUrl: '', apiKey: '', model: '' },
} satisfies AppConfig;

const split = (content: string) => splitContent(defaultConfig, content);

describe('splitContent（RecursiveCharacterTextSplitter, markdown 优先）', () => {
  it('空文档切出 0 片', async () => {
    await expect(split('')).resolves.toEqual([]);
  });

  it('短文档单片返回', async () => {
    const chunks = await split('# 标题\n正文一段。');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('# 标题');
  });

  it('超长纯文本按 ~500/50 递归切分，数量与重叠可预期', async () => {
    // 1200 个可区分字符（0123456789 循环），无任何分隔符 → 退化到字符级切分。
    const text = Array.from({ length: 1200 }, (_, i) => String(i % 10)).join(
      '',
    );
    const chunks = await split(text);

    expect(chunks.length).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
      expect(chunk.length).toBeLessThanOrEqual(500);
    }
    // 相邻切片共享 50 字符重叠。
    expect(chunks[1].startsWith(chunks[0].slice(-50))).toBe(true);
    expect(chunks[2].startsWith(chunks[1].slice(-50))).toBe(true);
    // 内容无丢失：去掉重叠后可还原原文。
    const reassembled = chunks[0] + chunks[1].slice(50) + chunks[2].slice(50);
    expect(reassembled).toBe(text);
  });

  it('Markdown 结构优先：标题边界处切分，序号即数组下标', async () => {
    const para = '这是一段足够长的正文。'.repeat(30); // ~330 字符
    const text = [
      `# 文档`,
      `## 第一节`,
      para,
      `## 第二节`,
      para,
      `## 第三节`,
      para,
    ].join('\n\n');
    const chunks = await split(text);

    // 实测确定性行为：首片 = 文档标题 + 第一节（合计 344 < 500 合并），
    // 第二/三节在 "\n## " 结构分隔符处各自成片的开头。
    expect(chunks).toHaveLength(3);
    expect(chunks[0].startsWith('# 文档')).toBe(true);
    expect(chunks[0]).toContain('## 第一节');
    expect(chunks[1].startsWith('## 第二节')).toBe(true);
    expect(chunks[2].startsWith('## 第三节')).toBe(true);
  });
});
