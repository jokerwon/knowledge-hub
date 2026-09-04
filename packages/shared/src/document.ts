// 文档域契约：描述文档实体在前后端间的形状。
// 字段一律 snake_case 与存储层对齐，TS 侧 id/时间均 string。

// ADR 0001 起异步摄取：受理即 processing，后台收敛到 ready / failed。
export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface DocumentDto {
  id: string;
  title: string;
  status: DocumentStatus;
  created_at: string; // ISO 8601
  // failed 时的失败原因（分类文案）；processing / ready 为 null。
  failure_reason: string | null;
}
