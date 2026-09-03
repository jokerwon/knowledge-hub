import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { SESSION_MAX_AGE_SECONDS } from '@kh/shared';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET 未配置，请检查 .env');
        // 有效期与 web 侧 cookie maxAge 同源（@kh/shared），两边不漂移。
        return { secret, signOptions: { expiresIn: SESSION_MAX_AGE_SECONDS } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // 全局守卫：所有模块（documents 等）默认受保护，公开端点用 @Public() 显式豁免。
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
