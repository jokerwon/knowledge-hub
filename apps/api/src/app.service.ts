import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@kh/shared';

@Injectable()
export class AppService {
  getHello(): string {
    return `Hello World! (${APP_NAME})`;
  }
}
