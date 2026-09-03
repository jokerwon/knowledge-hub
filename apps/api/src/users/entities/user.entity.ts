import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// 受邀制账号：由 CLI（scripts/user-cli.ts）创建，不开放注册。
@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  // 大小写敏感的精确匹配登录；内网小团队不做 citext/归一化。
  @Column({ type: 'text', unique: true })
  username!: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash!: string;

  // 改密时 +1；JWT payload 携带签发时的版本，guard 比对不一致即拒绝（即时吊销）。
  @Column({ type: 'integer', name: 'token_version', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
