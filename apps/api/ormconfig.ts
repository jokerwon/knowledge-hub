import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './src/database/data-source';

// TypeORM CLI 入口：`typeorm -d ormconfig.ts migration:*`。
// ts-node 在 CommonJS 模式下运行此文件（见 package.json scripts），因此不要使用顶层 await。
const options = buildDataSourceOptions();

export default new DataSource(options);
