import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
} from '@kh/shared';
import type { UserEntity } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { validatePassword, verifyPassword } from '../users/password';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // 统一「用户名或密码错误」：不区分用户不存在与密码错误，避免用户名枚举。
  async login(body: LoginRequest): Promise<LoginResponse> {
    if (
      typeof body?.username !== 'string' ||
      typeof body?.password !== 'string'
    ) {
      throw new BadRequestException('缺少 username / password 字段');
    }
    const user = await this.usersService.findByUsername(body.username);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return this.toLoginResponse(user);
  }

  // 改密：验旧密码 → 新哈希 + tokenVersion+1 → 签发新 token（当前会话不掉线）。
  async changePassword(
    userId: string,
    body: ChangePasswordRequest,
  ): Promise<LoginResponse> {
    if (
      typeof body?.old_password !== 'string' ||
      typeof body?.new_password !== 'string'
    ) {
      throw new BadRequestException('缺少 old_password / new_password 字段');
    }
    const passwordError = validatePassword(body.new_password);
    if (passwordError) throw new BadRequestException(passwordError);

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('登录已失效，请重新登录');
    if (!(await verifyPassword(body.old_password, user.passwordHash))) {
      throw new BadRequestException('旧密码不正确');
    }
    const updated = await this.usersService.applyNewPassword(
      user,
      body.new_password,
    );
    return this.toLoginResponse(updated);
  }

  private toLoginResponse(user: UserEntity): LoginResponse {
    return {
      access_token: this.jwtService.sign({
        sub: user.id,
        username: user.username,
        tv: user.tokenVersion,
      }),
      user: { id: user.id, username: user.username },
    };
  }
}
