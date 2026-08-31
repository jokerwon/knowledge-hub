// 文档域契约：描述文档实体在前后端间的形状。
// 字段一律 snake_case 与存储层对齐，TS 侧 id/时间均 string。

export type DocumentStatus = 'ready' | 'failed';

export interface DocumentDto {
  id: string;
  title: string;
  status: DocumentStatus;
  created_at: string; // ISO 8601
}
