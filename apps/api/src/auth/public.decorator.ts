import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// 标记公开端点（如 /auth/login），全局 JwtAuthGuard 据此放行。
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
