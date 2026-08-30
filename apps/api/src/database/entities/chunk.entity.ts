import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { EMBEDDING_DIM, vectorTransformer } from '../vector-transformer';
import { DocumentEntity } from './document.entity';

@Entity('chunks')
export class ChunkEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ type: 'int' })
  seq!: number;

  @Column({ type: 'text' })
  content!: string;

  // pgvector 自定义列：实体侧 number[]，库侧 "[0.1,0.2,...]" 字符串。
  //
  // ⚠️ HNSW 索引（chunks_embedding_hnsw_idx）由 migration 使用 `USING hnsw ... vector_cosine_ops`
  // 创建，TypeORM 1.1 不支持表达 HNSW / operator class，因此实体**不**声明 @Index。
  // 运行 migration:generate 后 TypeORM 会"建议" DROP INDEX chunks_embedding_hnsw_idx，
  // review 时**务必删除该条**，避免误删影响余弦查询性能。
  @Column({
    type: 'vector',
    length: EMBEDDING_DIM,
    transformer: vectorTransformer,
  })
  embedding!: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => DocumentEntity, (doc) => doc.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id', foreignKeyConstraintName: 'chunks_document_id_fkey' })
  document!: DocumentEntity;
}
