#!/usr/bin/env node
// P3-7 双库冒烟：验证 TypeORM migration + pgvector 余弦查询 + Mongoose document_contents 唯一索引。
// 运行方式（从 apps/api 目录）：
//   cross-env TS_NODE_PROJECT=tsconfig.cli.json node --require ts-node/register --require tsconfig-paths/register scripts/smoke-db.ts
import * as dotenv from 'dotenv';
import * as path from 'node:path';
dotenv.config({ path: path.resolve(process.cwd(), '..', '..', '.env') });

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DEFAULT_EMBEDDING_DIM } from '@kh/shared';
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
      `SELECT name FROM typeorm_migrations ORDER BY timestamp`,
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
      applied.rows.some((r) => r.name.startsWith('CreateChunks')),
      'CreateChunks migration 已应用',
    );

    // ---- 2. 表结构与 vector 扩展 ----
    const tables: QueryResult<Row> = await pg.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('documents','chunks')
    `);
    check(tables.rows.length === 2, 'documents 与 chunks 表存在');

    const vec: QueryResult<Row> = await pg.query(
      `SELECT extversion FROM pg_extension WHERE extname='vector'`,
    );
    check(
      vec.rows.length > 0,
      `pgvector 扩展已装 (v${vec.rows[0]?.extversion})`,
    );

    const idx: QueryResult<Row> = await pg.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename='chunks' AND indexname='chunks_embedding_hnsw_idx'
    `);
    check(idx.rows.length > 0, 'HNSW 索引存在');
    check(
      idx.rows[0]?.indexdef.includes('hnsw') &&
        idx.rows[0]?.indexdef.includes('vector_cosine_ops'),
      '索引算法 = HNSW, opclass = vector_cosine_ops',
    );

    // ---- 3. 向量插入 + 余弦查询 ----
    const docId = randomUUID();
    const chunkIds = [randomUUID(), randomUUID(), randomUUID()];
    const dim = Number(process.env.EMBEDDING_DIM) || DEFAULT_EMBEDDING_DIM;
    // 构造三条向量，方向彼此不同；已知 query 方向应与第 1 条最近，第 3 条最远。
    const vNear = new Array(dim).fill(0).map((_, i) => (i % 2 === 0 ? 1 : 0));
    const vMid = new Array(dim).fill(0.5);
    const vFar = new Array(dim).fill(0).map((_, i) => (i % 2 === 1 ? 1 : 0));
    const embeddings = [vNear, vMid, vFar];

    await pg.query('BEGIN');
    await pg.query(
      `INSERT INTO documents(id,title,status) VALUES ($1,'smoke','ready')`,
      [docId],
    );
    for (let i = 0; i < chunkIds.length; i++) {
      await pg.query(
        `INSERT INTO chunks(id,document_id,seq,content,embedding)
         VALUES ($1,$2,$3,$4,$5::vector)`,
        [chunkIds[i], docId, i, `chunk-${i}`, JSON.stringify(embeddings[i])],
      );
    }

    const query = vNear;
    const nearest: QueryResult<Row> = await pg.query(
      `SELECT id, seq, 1 - (embedding <=> $1::vector) AS cosine
       FROM chunks WHERE document_id=$2
       ORDER BY embedding <=> $1::vector`,
      [JSON.stringify(query), docId],
    );
    console.log(
      '  nearest-first seq order:',
      nearest.rows.map((r) => r.seq),
    );
    check(
      nearest.rows.length === 3 && nearest.rows[0].seq === 0,
      'ORDER BY embedding <=> 排序正确（第 0 条最接近）',
    );

    // ---- 4. EXPLAIN ANALYZE 验证 HNSW 索引被用到 ----
    const plan: QueryResult<Row> = await pg.query(
      `EXPLAIN (FORMAT JSON) SELECT id FROM chunks ORDER BY embedding <=> $1::vector LIMIT 5`,
      [JSON.stringify(query)],
    );
    const planText = JSON.stringify(plan.rows[0]);
    check(
      planText.toLowerCase().includes('hnsw') ||
        planText.toLowerCase().includes('index scan'),
      '执行计划命中索引（HNSW 或 Index Scan）',
    );

    // ---- 5. Mongoose：document_contents 唯一索引 ----
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

    // ---- 6. 清理：PG 行（chunks 级联） ----
    await pg.query(`DELETE FROM documents WHERE id=$1`, [docId]);
    await pg.query('COMMIT');
    console.log('\n[OK] 双库冒烟全部通过');
  } catch (e) {
    try {
      await pg.query('ROLLBACK');
    } catch {
      // 忽略 ROLLBACK 失败（连接已断开等），原始异常继续抛出
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
