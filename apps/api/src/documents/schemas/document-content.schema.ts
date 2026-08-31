import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Mongo 侧唯一的集合：存储 MD/TXT 正文，按 document_id 关联 PG 元数据。
// document_id 建唯一索引，等价于"一份正文对应一份文档"。unique 自带索引，无需 index:true。
@Schema({
  collection: 'document_contents',
  timestamps: false,
  versionKey: false,
})
export class DocumentContent {
  @Prop({ type: String, required: true, unique: true })
  document_id!: string;

  @Prop({ type: String, required: true })
  content!: string;
}

export type DocumentContentDoc = HydratedDocument<DocumentContent>;
export const DocumentContentSchema =
  SchemaFactory.createForClass(DocumentContent);
