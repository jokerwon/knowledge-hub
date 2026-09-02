import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';
import type { DocumentStatus } from '@kh/shared';

@Entity('documents')
// CHECK 约束与 migration 保持一致；TypeORM 据此判断无需改动。
@Check('documents_status_check', `status IN ('ready','failed')`)
export class DocumentEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text' })
  status!: DocumentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // 软删除：repo.softDelete() 写入时间戳，find() 默认排除已删除行；
  // 列由 migration 显式创建（synchronize: false）。
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;
}
