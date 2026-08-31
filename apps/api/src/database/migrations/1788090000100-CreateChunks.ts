import type { MigrationInterface, QueryRunner } from 'typeorm';
import { EMBEDDING_DIM } from '../vector-transformer';

// P3-4：chunks 表 + HNSW 索引。
// embedding 维度由 EMBEDDING_DIM 环境变量决定（默认 768），换维度需新迁移 + 文档重传。
// 余弦相似度查询使用 <=>，HNSW 索引须以 vector_cosine_ops 建。
//
// 运维约定：TypeORM 1.1 不支持 HNSW / operator class，因此实体不声明此索引。
// 运行 migration:generate 后 TypeORM 会"建议" DROP INDEX chunks_embedding_hnsw_idx，
// review 时**务必删除该条**，避免误删影响余弦查询性能。
export class CreateChunks1788090000100 implements MigrationInterface {
  name = 'CreateChunks1788090000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE chunks (
        id          uuid PRIMARY KEY,
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        seq         int  NOT NULL,
        content     text NOT NULL,
        embedding   vector(${EMBEDDING_DIM}) NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
        ON chunks USING hnsw (embedding vector_cosine_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS chunks_embedding_hnsw_idx`);
    await queryRunner.query(`DROP TABLE IF EXISTS chunks`);
  }
}
