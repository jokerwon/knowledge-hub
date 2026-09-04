import type { MigrationInterface, QueryRunner } from 'typeorm';

// ADR 0001 异步摄取的 schema 变更：
// - status 状态机扩入中间态 processing（受理 → ready | failed）
// - failure_reason：failed 时的原因文案（nullable）
// - mineru_task_id：PDF 提交 MinerU 后的批次号，启动恢复凭它续轮询（nullable）
export class AddAsyncIngestion1788500000000 implements MigrationInterface {
  name = 'AddAsyncIngestion1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documents DROP CONSTRAINT documents_status_check;
      ALTER TABLE documents
        ADD CONSTRAINT documents_status_check
        CHECK (status IN ('processing','ready','failed'));
      ALTER TABLE documents
        ADD COLUMN failure_reason text NULL,
        ADD COLUMN mineru_task_id text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE documents
        DROP COLUMN failure_reason,
        DROP COLUMN mineru_task_id;
      ALTER TABLE documents DROP CONSTRAINT documents_status_check;
      ALTER TABLE documents
        ADD CONSTRAINT documents_status_check
        CHECK (status IN ('ready','failed'))
    `);
  }
}
