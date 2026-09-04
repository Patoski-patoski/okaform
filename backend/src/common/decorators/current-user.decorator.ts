import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserProfile } from '../types/auth.types';

interface RequestWithUser {
  user: UserProfile;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserProfile => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

export type { UserProfile } from '../types/auth.types';
