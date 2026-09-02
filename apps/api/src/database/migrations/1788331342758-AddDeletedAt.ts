import type { MigrationInterface, QueryRunner } from 'typeorm';

// documents 加 deleted_at：软删除标记列。
// - repo.softDelete() 写入时间戳，find() 默认排除非空行
// - 可空：存量行全部视为未删除
export class AddDeletedAt1788331342758 implements MigrationInterface {
  name = 'AddDeletedAt1788331342758';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documents
        ADD COLUMN deleted_at timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documents
        DROP COLUMN deleted_at
    `);
  }
}
