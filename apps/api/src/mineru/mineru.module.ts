import { Module } from '@nestjs/common';
import { MineruClient } from './mineru.client';

// MinerU 客户端模块（issue #1 模块边界决策）：封装任务创建/轮询/结果下载，
// 对外只暴露 MineruClient。token 缺失时在实例化期 fail-fast（见构造器）。
@Module({
  providers: [MineruClient],
  exports: [MineruClient],
})
export class MineruModule {}
