import type { MigrationInterface, QueryRunner } from 'typeorm';

// 创建 documents 表：
// - id uuid PK 由应用层生成
// - content 存 MD/TXT 正文（≤ UPLOAD_MAX_BYTES，默认 2 MiB）
// - user_id uuid NULL 为多用户演进预留
// - status 用 CHECK 约束限定 ready/failed
export class CreateDocuments1788090000000 implements MigrationInterface {
  name = 'CreateDocuments1788090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE documents (
        id          uuid PRIMARY KEY,
        title       text NOT NULL,
        content     text NOT NULL,
        status      text NOT NULL CHECK (status IN ('ready','failed')),
        user_id     uuid NULL,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS documents`);
  }
}
