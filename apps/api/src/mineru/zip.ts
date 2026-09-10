import { inflateRawSync } from 'node:zlib';

// MinerU 结果包读取：支持 full.md 与图片资源，覆盖 stored(0) 和 deflate(8)。
// 所有外部 ZIP 偏移和输出长度均校验，防损坏包与 zip 炸弹。
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ENTRY_OUTPUT_BYTES = 64 * 1024 * 1024;

export interface ZipEntry {
  name: string;
  data: Buffer;
}

export function extractZipEntry(zip: Buffer, entryName: string): Buffer {
  const entry = extractZipEntries(zip).find(
    (candidate) => candidate.name === entryName,
  );
  if (!entry) throw new Error(`zip 结果包中不存在条目 ${entryName}`);
  return entry.data;
}

export function extractZipEntries(zip: Buffer): ZipEntry[] {
  if (zip.length < 22) {
    throw new Error(`zip 结果包过小（${zip.length} 字节），无法解析`);
  }
  const eocd = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    if (
      offset + 46 > zip.length ||
      zip.readUInt32LE(offset) !== CENTRAL_SIGNATURE
    ) {
      throw new Error(`zip 中央目录损坏（偏移 ${offset}）`);
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLen = zip.readUInt16LE(offset + 28);
    const extraLen = zip.readUInt16LE(offset + 30);
    const commentLen = zip.readUInt16LE(offset + 32);
    const nameEnd = offset + 46 + nameLen;
    if (nameEnd + extraLen + commentLen > zip.length) {
      throw new Error(`zip 中央目录条目越界（偏移 ${offset}）`);
    }
    const name = zip.subarray(offset + 46, nameEnd).toString('utf8');
    const localOffset = zip.readUInt32LE(offset + 42);
    entries.push({
      name,
      data: readEntryData(zip, localOffset, compressedSize, method),
    });
    offset = nameEnd + extraLen + commentLen;
  }
  return entries;
}

function readEntryData(
  zip: Buffer,
  localOffset: number,
  compressedSize: number,
  method: number,
): Buffer {
  if (
    localOffset + 30 > zip.length ||
    zip.readUInt32LE(localOffset) !== LOCAL_SIGNATURE
  ) {
    throw new Error(`zip 本地头损坏（偏移 ${localOffset}）`);
  }
  const nameLen = zip.readUInt16LE(localOffset + 26);
  const extraLen = zip.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  if (dataStart > zip.length || compressedSize > zip.length - dataStart) {
    throw new Error(
      `zip 条目数据越界：dataStart=${dataStart} compressedSize=${compressedSize} 总长=${zip.length}`,
    );
  }
  const data = zip.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) {
    return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_OUTPUT_BYTES });
  }
  throw new Error(`zip 条目使用了不支持的压缩方法 ${method}`);
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const searchFloor = Math.max(0, zip.length - 22 - 65535);
  for (let i = zip.length - 22; i >= searchFloor; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error('zip 结果包缺少 End of Central Directory');
}
