import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || { id: request.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001', role: 'ADMIN' };
  },
);
