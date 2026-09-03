import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import type {
  AuthUserDto,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
} from '@kh/shared';
import type { UserEntity } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  // guard 已加载用户并挂到 request，此处零额外查询。
  @Get('me')
  me(@CurrentUser() user: UserEntity): AuthUserDto {
    return { id: user.id, username: user.username };
  }

  // 改密成功返回新 token：web 侧用其覆盖 cookie，当前会话不掉线。
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: UserEntity,
    @Body() body: ChangePasswordRequest,
  ): Promise<LoginResponse> {
    return this.authService.changePassword(user.id, body);
  }
}
