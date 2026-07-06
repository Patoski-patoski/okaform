import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { UsersService } from './users.service';
import { User, UserDocument } from '../common/schemas/user.schema';
import {
  SurveyResponse,
  ResponseDocument,
} from '../common/schemas/response.schema';
import { UsernameTakenException } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: jest.Mocked<Model<UserDocument>>;
  let responseModel: jest.Mocked<Model<ResponseDocument>>;

  const mockUser: Partial<UserDocument> = {
    wallet: 'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
    username: 'testuser',
    globalScore: 75,
    surveysCompleted: 12,
    badgeTier: 'Gold' as any,
    // createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
          },
        },
        {
          provide: getModelToken(SurveyResponse.name),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userModel = module.get(getModelToken(User.name));
    responseModel = module.get(getModelToken(SurveyResponse.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfileByWallet', () => {
    it('should return user profile for valid wallet', async () => {
      userModel.findOne.mockResolvedValue(mockUser as UserDocument);

      const result = await service.getProfileByWallet(
        'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
      );

      expect(result.wallet).toBe(mockUser.wallet);
      expect(result.username).toBe(mockUser.username);
      expect(result.globalScore).toBe(mockUser.globalScore);
      expect(result.surveysCompleted).toBe(mockUser.surveysCompleted);
      expect(result.badgeTier).toBe(mockUser.badgeTier);
    });

    it('should throw NotFoundException for unknown wallet', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.getProfileByWallet('UNKNOWN_WALLET_ADDRESS_HERE'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle user with null username', async () => {
      const userNoUsername = { ...mockUser, username: null };
      userModel.findOne.mockResolvedValue(userNoUsername as UserDocument);

      const result = await service.getProfileByWallet(
        'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
      );

      expect(result.username).toBeNull();
    });

    it('should handle user with undefined fields gracefully', async () => {
      const sparseUser = { wallet: 'WALLET123' };
      userModel.findOne.mockResolvedValue(sparseUser as UserDocument);

      const result = await service.getProfileByWallet('WALLET123');

      expect(result.globalScore).toBe(0);
      expect(result.surveysCompleted).toBe(0);
      expect(result.badgeTier).toBe('Grey');
    });
  });

  describe('setUsername', () => {
    it('should set username for existing user', async () => {
      userModel.findOne.mockResolvedValue(null); // no existing user with that username
      userModel.findOneAndUpdate.mockResolvedValue({
        ...mockUser,
        username: 'newname',
      });

      const result = await service.setUsername(
        'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
        'newname',
      );

      expect(result.username).toBe('newname');
      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        { wallet: 'ABC123DEF456GHI789JKL012MNO345PQR678STU901' },
        { username: 'newname' },
        { new: true },
      );
    });

    it('should throw UsernameTakenException if username is taken by another user', async () => {
      const existingUser = {
        wallet: 'DIFFERENT_WALLET_ADDRESS',
        username: 'takenname',
      };
      userModel.findOne.mockResolvedValue(existingUser as UserDocument);

      await expect(
        service.setUsername(
          'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
          'takenname',
        ),
      ).rejects.toThrow(UsernameTakenException);
    });

    it('should allow setting same username for same user', async () => {
      userModel.findOne.mockResolvedValue({
        wallet: 'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
        username: 'samename',
      } as UserDocument);
      userModel.findOneAndUpdate.mockResolvedValue({
        ...mockUser,
        username: 'samename',
      });

      const result = await service.setUsername(
        'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
        'samename',
      );

      expect(result.username).toBe('samename');
    });

    it('should throw NotFoundException if user not found', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.setUsername('UNKNOWN_WALLET', 'newname'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSurveyHistory', () => {
    it('should return survey history for user', async () => {
      userModel.findOne.mockResolvedValue(mockUser as UserDocument);

      const mockResponses = [
        {
          formId: { _id: 'form1', title: 'Survey 1' },
          submittedAt: new Date('2026-06-01'),
          scoreAtSubmission: 85,
        },
        {
          formId: { _id: 'form2', title: 'Survey 2' },
          submittedAt: new Date('2026-06-15'),
          scoreAtSubmission: 90,
        },
      ];

      const chainable = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResponses),
      };
      responseModel.find.mockReturnValue(chainable as any);

      const result = await service.getSurveyHistory(
        'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
      );

      expect(result).toHaveLength(2);
      expect(result[0].formTitle).toBe('Survey 1');
      expect(result[0].scoreAtSubmission).toBe(85);
      expect(result[1].formTitle).toBe('Survey 2');
    });

    it('should throw NotFoundException for unknown wallet', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(service.getSurveyHistory('UNKNOWN_WALLET')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array for user with no responses', async () => {
      userModel.findOne.mockResolvedValue(mockUser as UserDocument);

      const chainable = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      responseModel.find.mockReturnValue(chainable as any);

      const result = await service.getSurveyHistory(
        'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
      );

      expect(result).toHaveLength(0);
    });

    it('should handle missing form title gracefully', async () => {
      userModel.findOne.mockResolvedValue(mockUser as UserDocument);

      const mockResponses = [
        {
          formId: { _id: 'form1' }, // no title
          submittedAt: new Date('2026-06-01'),
          scoreAtSubmission: 85,
        },
      ];

      const chainable = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockResponses),
      };
      responseModel.find.mockReturnValue(chainable as any);

      const result = await service.getSurveyHistory(
        'ABC123DEF456GHI789JKL012MNO345PQR678STU901',
      );

      expect(result[0].formTitle).toBe('Untitled');
    });
  });
});
