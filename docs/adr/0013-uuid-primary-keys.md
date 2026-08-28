# ADR-0013：主键策略——UUID

- 状态：已接受
- 日期：2026-08-28

## 背景

主键可选 BIGSERIAL 自增、UUID、雪花 ID。MVP 单库单机，但需考虑 JS 侧数值精度与演进成本。

## 决策

- 全部表使用 **UUID** 主键（PG `uuid` 类型，应用层生成）。
- JS/TS 侧一律以 string 承载，无数值精度问题。
- 不引入雪花 ID 生成器。

## 后果

- 无序列协调、无 2^53 精度坑；代价是索引体积略大于 bigint，万级数据量下无感。
- 未来多用户/多库演进无需主键改造。

## 附：领域模型确认

第 4 轮出示的领域模型草案（PG `documents` + `chunks`，Mongo `document_contents`，Document 为聚合根、Chunk 从属，会话不入库）经决策人确认，无修改。
