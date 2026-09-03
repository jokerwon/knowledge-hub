import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import { hashPassword } from './password';
import { UserEntity } from './entities/user.entity';

// 用户读写集中在 UsersService；auth 域只做认证编排，不直接碰 repo。
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  findByUsername(username: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { username } });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  // 建号：用户名唯一由 DB 约束保证，冲突时由调用方处理 23505。
  async create(username: string, password: string): Promise<UserEntity> {
    return this.usersRepo.save({
      id: randomUUID(),
      username,
      passwordHash: await hashPassword(password),
      tokenVersion: 0,
    });
  }

  // 改密 + 递增 tokenVersion：所有旧 JWT 立即失效。
  // 传入已加载的实体（调用方需先验旧密码），避免二次查询。
  async applyNewPassword(
    user: UserEntity,
    newPassword: string,
  ): Promise<UserEntity> {
    user.passwordHash = await hashPassword(newPassword);
    user.tokenVersion += 1;
    return this.usersRepo.save(user);
  }
}
