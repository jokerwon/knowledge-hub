// LangChain 边界 ①：切分。ADR-0012 指定 RecursiveCharacterTextSplitter，
// 分隔符优先 Markdown 结构再退化字符；langchain 相关 import 只允许出现在 ingest/（ADR-0007）。
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { config } from '../config';

export function createTextSplitter(): RecursiveCharacterTextSplitter {
  return RecursiveCharacterTextSplitter.fromLanguage('markdown', {
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });
}

export function splitContent(content: string): Promise<string[]> {
  return createTextSplitter().splitText(content);
}
