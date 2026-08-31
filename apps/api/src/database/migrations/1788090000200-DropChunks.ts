import type { MigrationInterface, QueryRunner } from 'typeorm';

// 精简：删除 chunks 表（含 HNSW 索引）与 pgvector 扩展——检索管线已下线。
// down 仅重建空扩展，不重建表：历史迁移（CreateChunks）已从代码删除，无法重放。
export class DropChunks1788090000200 implements MigrationInterface {
  name = 'DropChunks1788090000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chunks`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  }
}
