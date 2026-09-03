// 认证域契约：登录 / 会话 / 改密的请求响应形状与常量。
// 字段一律 snake_case 与存储层对齐，TS 侧 id/时间均 string。

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  username: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUserDto;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

// 会话 cookie 名：web 侧 Next 服务器持有，浏览器不直连 api。
export const SESSION_COOKIE = 'kh_session';

// 会话时长（秒）：与 api JWT expiresIn（7d）保持一致，两边引用同一常量防漂移。
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
