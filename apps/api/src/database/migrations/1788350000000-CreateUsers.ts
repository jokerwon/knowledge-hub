import type { MigrationInterface, QueryRunner } from 'typeorm';

// 创建 users 表：
// - id uuid PK 由应用层生成
// - username 唯一（大小写敏感精确匹配）
// - password_hash 存 bcrypt 哈希（10 rounds）
// - token_version 改密 +1，配合 JWT payload 实现旧 token 即时吊销
export class CreateUsers1788350000000 implements MigrationInterface {
  name = 'CreateUsers1788350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id             uuid PRIMARY KEY,
        username       text NOT NULL UNIQUE,
        password_hash  text NOT NULL,
        token_version  integer NOT NULL DEFAULT 0,
        created_at     timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
