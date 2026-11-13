import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'] || request.user?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Multi-tenant header x-tenant-id or authenticated user tenantId is required.');
    }

    request.tenantId = tenantId;
    return true;
  }
}
