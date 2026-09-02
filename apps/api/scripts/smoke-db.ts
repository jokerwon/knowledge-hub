#!/usr/bin/env node
// PG 冒烟：migration 状态 + documents 表结构（含 content 列）+ 写入/读取/删除往返。
// 运行方式（从 apps/api 目录）：
//   TS_NODE_PROJECT=tsconfig.cli.json node --require ts-node/register scripts/smoke-db.ts
import '../src/config';

import { randomUUID } from 'node:crypto';
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
  if (!PG_URL) fail('DATABASE_URL 未配置');

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

    // ---- 2. documents 表结构：五列齐全（含 content）----
    const cols: QueryResult<Row> = await pg.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='documents'
    `);
    const names = cols.rows.map((r) => r.column_name);
    check(
      ['id', 'title', 'content', 'status', 'created_at'].every((c) =>
        names.includes(c),
      ),
      'documents 表结构完整（含 content 列）',
    );

    // ---- 3. 写入/读取/删除往返 ----
    const id = randomUUID();
    await pg.query(
      `INSERT INTO documents (id, title, content, status) VALUES ($1, $2, $3, 'ready')`,
      [id, 'smoke', '# Smoke\nhello'],
    );
    const got: QueryResult<Row> = await pg.query(
      `SELECT content FROM documents WHERE id = $1`,
      [id],
    );
    check(got.rows[0]?.content === '# Smoke\nhello', 'content 写入并可读取');
    await pg.query(`DELETE FROM documents WHERE id = $1`, [id]);

    console.log('\n[OK] PG 冒烟全部通过');
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error('[SMOKE ERROR]', e);
  process.exit(1);
});
