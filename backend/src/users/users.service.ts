import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../common/schemas/user.schema';
import {
  SurveyResponse,
  ResponseDocument,
} from '../common/schemas/response.schema';
import { OkaformException } from '../common/exceptions/base.exception';
import { UsernameCooldownException } from '../common/exceptions/auth/username-cooldown.exception';
import { HttpStatus } from '@nestjs/common';

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface UserProfileResponse {
  wallet: string;
  username: string | null;
  globalScore: number;
  surveysCompleted: number;
  badgeTier: string;
  createdAt: Date;
}

export interface SurveyHistoryItem {
  formId: string;
  formTitle: string;
  submittedAt: Date;
  scoreAtSubmission: number;
}

export class UsernameTakenException extends OkaformException {
  constructor(username: string) {
    super(
      {
        code: 'USERNAME_TAKEN',
        detail: `Username "${username}" is already taken.`,
        context: { username },
      },
      HttpStatus.CONFLICT,
    );
  }
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel('SurveyResponse')
    private responseModel: Model<ResponseDocument>,
  ) {}

  async getProfileByWallet(wallet: string): Promise<UserProfileResponse> {
    const user = await this.userModel.findOne({ wallet });
    if (!user) {
      throw new NotFoundException(
        `User with wallet ${wallet.slice(0, 8)}... not found`,
      );
    }

    return {
      wallet: user.wallet ?? wallet,
      username: user.username ?? null,
      globalScore: user.globalScore ?? 0,
      surveysCompleted: user.surveysCompleted ?? 0,
      badgeTier: user.badgeTier ?? 'Ghost',
      createdAt:
        (user as unknown as { createdAt: Date }).createdAt ?? new Date(),
    };
  }

  async setUsername(
    wallet: string,
    username: string,
  ): Promise<{ wallet: string; username: string; cooldownDays?: number }> {
    const normalizedUsername = username.toLowerCase();

    const user = await this.userModel.findOne({ wallet });
    if (!user) {
      throw new NotFoundException(
        `User with wallet ${wallet.slice(0, 8)}... not found`,
      );
    }

    if (user.username && user.usernameUpdatedAt) {
      const elapsed = Date.now() - user.usernameUpdatedAt.getTime();
      if (elapsed < USERNAME_COOLDOWN_MS) {
        const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / 86400000);
        throw new UsernameCooldownException(daysLeft);
      }
    }

    const existing = await this.userModel.findOne({
      username: normalizedUsername,
    });
    if (existing && existing.wallet !== wallet) {
      throw new UsernameTakenException(username);
    }

    user.username = normalizedUsername;
    user.usernameUpdatedAt = new Date();
    await user.save();

    this.logger.log({
      event: 'USERNAME_SET',
      wallet: wallet.slice(0, 8) + '...',
      username: normalizedUsername,
    });

    return {
      wallet: user.wallet ?? wallet,
      username: user.username ?? normalizedUsername,
    };
  }

  async getSurveyHistory(wallet: string): Promise<SurveyHistoryItem[]> {
    const user = await this.userModel.findOne({ wallet });
    if (!user) {
      throw new NotFoundException(
        `User with wallet ${wallet.slice(0, 8)}... not found`,
      );
    }

    const responses = await this.responseModel
      .find({ respondentWallet: wallet })
      .populate('formId', 'title')
      .sort({ submittedAt: -1 })
      .limit(50)
      .exec();

    return responses.map((r: SurveyResponse) => ({
      formId: r.formId._id.toString(),
      formTitle: (r.formId as { title?: string }).title ?? 'Untitled',
      submittedAt: r.submittedAt ?? new Date(),
      scoreAtSubmission: r.scoreAtSubmission ?? 0,
    }));
  }
}
