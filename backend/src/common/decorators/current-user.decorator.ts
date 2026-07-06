import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserProfile {
  wallet: string;
  username: string | null;
  globalScore: number;
  surveysCompleted: number;
  badgeTier: string;
}

interface RequestWithUser {
  user: UserProfile;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserProfile => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
