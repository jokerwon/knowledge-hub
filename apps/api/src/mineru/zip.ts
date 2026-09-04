import { inflateRawSync } from 'node:zlib';

// 极简 zip 读取：只服务于 MinerU 结果包（取出 full.md 单个条目）。
// 走「中央目录定位条目 → 本地头算数据偏移」的标准路径：数据长度取自中央目录
// （本地头在流式写入时可能没有大小，bit-3 数据描述符场景天然兼容）。
// 压缩方法覆盖 stored(0) 与 deflate(8)；CRC 不校验（信任 CDN 完整性传输）。
// 结果包来自外部服务：所有偏移读取前做边界校验，损坏时给出领域错误而非
// RangeError；解压设输出上限，防 zip 炸弹。

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
// 单条目解压输出上限：MinerU 结果包是 100 页文档的 markdown + json，
// 正常远小于该值；超限视为异常结果直接失败。
const MAX_ENTRY_OUTPUT_BYTES = 64 * 1024 * 1024;

export function extractZipEntry(zip: Buffer, entryName: string): Buffer {
  if (zip.length < 22) {
    throw new Error(`zip 结果包过小（${zip.length} 字节），无法解析`);
  }
  const eocd = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);

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
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip
      .subarray(offset + 46, offset + 46 + nameLen)
      .toString('utf8');

    if (name === entryName) {
      return readEntryData(zip, localOffset, compressedSize, method);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip 结果包中不存在条目 ${entryName}`);
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
  // 本地头的 name/extra 长度可能与中央目录不同，须按本地头自身计算数据起点
  const nameLen = zip.readUInt16LE(localOffset + 26);
  const extraLen = zip.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  if (dataStart + compressedSize > zip.length) {
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
  // EOCD 定长 22 字节，前置注释最长 65535 字节
  const searchFloor = Math.max(0, zip.length - 22 - 65535);
  for (let i = zip.length - 22; i >= searchFloor; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error('zip 结果包缺少 End of Central Directory');
}
