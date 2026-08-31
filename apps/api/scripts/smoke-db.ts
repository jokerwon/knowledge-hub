#!/usr/bin/env node
// 双库冒烟：验证 TypeORM migration 状态 + documents 表 + Mongoose document_contents 唯一索引。
// 运行方式（从 apps/api 目录）：
//   cross-env TS_NODE_PROJECT=tsconfig.cli.json node --require ts-node/register --require tsconfig-paths/register scripts/smoke-db.ts
import * as dotenv from 'dotenv';
import * as path from 'node:path';
dotenv.config({ path: path.resolve(process.cwd(), '..', '..', '.env') });

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Client } from 'pg';
import type { QueryResult } from 'pg';

const fail = (msg: string): never => {
  console.error('[FAIL]', msg);
  process.exit(1);
};

const check = (cond: unknown, label: string) => {
  if (cond) console.log('[PASS]', label);
  else fail(label);
};

// pg.query 返回 QueryResult<any>，行类型未知；冒烟脚本统一按行形状标注，避免 unsafe-* 噪音。
type Row = Record<string, any>;

async function main() {
  const PG_URL = process.env.DATABASE_URL;
  const MONGO_URL = process.env.MONGO_URL;
  if (!PG_URL) fail('DATABASE_URL 未配置');
  if (!MONGO_URL) fail('MONGO_URL 未配置');

  const pg = new Client({
    connectionString: PG_URL,
    connectionTimeoutMillis: 8000,
  });
  await pg.connect();
  console.log('[TEST] PostgreSQL connected');

  try {
    // ---- 1. migration 已应用的证据 ----
    const applied: QueryResult<Row> = await pg.query(
      `SELECT name FROM migrations ORDER BY timestamp`,
    );
    console.log(
      '  applied migrations:',
      applied.rows.map((r) => r.name).join(', '),
    );
    check(
      applied.rows.some((r) => r.name.startsWith('CreateDocuments')),
      'CreateDocuments migration 已应用',
    );
    check(
      applied.rows.some((r) => r.name.startsWith('DropChunks')),
      'DropChunks migration 已应用',
    );

    // ---- 2. 表结构：仅 documents，chunks 已删 ----
    const tables: QueryResult<Row> = await pg.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('documents','chunks')
    `);
    check(tables.rows.length === 1, 'documents 存在且 chunks 已删除');

    // ---- 3. Mongoose：document_contents 唯一索引 ----
    await mongoose.connect(MONGO_URL!);
    console.log('[TEST] MongoDB connected');
    const schema = new mongoose.Schema(
      {
        document_id: { type: String, required: true, unique: true },
        content: { type: String, required: true },
      },
      { collection: 'document_contents', versionKey: false },
    );
    const Model = mongoose.model('DocumentContent_Smoke', schema);
    await Model.init(); // 确保 unique 索引建好

    const docId = randomUUID();
    await Model.deleteMany({ document_id: docId });

    await Model.create({ document_id: docId, content: '# Smoke\nhello' });
    let dupFailed = false;
    try {
      await Model.create({ document_id: docId, content: 'duplicate' });
    } catch {
      dupFailed = true;
    }
    check(dupFailed, 'document_contents 唯一索引生效（重复 document_id 抛错）');

    const got = await Model.findOne({ document_id: docId });
    check(got?.content.startsWith('# Smoke'), 'content 可读取');

    await Model.deleteMany({ document_id: docId });
    await mongoose.disconnect();

    console.log('\n[OK] 双库冒烟全部通过');
  } catch (e) {
    try {
      await mongoose.disconnect();
    } catch {
      // 未连接时忽略
    }
    throw e;
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error('[SMOKE ERROR]', e);
  process.exit(1);
});
