import {
  Check,
  Column,
  CreateDateColumn,
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
  status!: DocumentStatus;

  // 多用户演进预留：当前为 NULL，未来补认证后回填。
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
