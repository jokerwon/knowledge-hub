import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserEntity } from '../users/entities/user.entity';
import type { AuthenticatedRequest } from './jwt-auth.guard';

// 取 JwtAuthGuard 注入到 request 上的当前用户：
//   @CurrentUser() user: UserEntity
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserEntity | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
