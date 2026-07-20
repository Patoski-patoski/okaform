import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService, SubmissionItem } from './submissions.service';

describe('SubmissionsController', () => {
  let controller: SubmissionsController;
  let submissionsService: jest.Mocked<SubmissionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [
        {
          provide: SubmissionsService,
          useValue: {
            getSubmissionsByForm: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SubmissionsController>(SubmissionsController);
    submissionsService = module.get(SubmissionsService);
  });

  describe('getSubmissions', () => {
    it('should return submissions for a form', async () => {
      const mockData: SubmissionItem[] = [
        {
          id: 'sub123',
          respondentWallet: 'wallet123',
          scoreAtSubmission: 0,
          similarityFlag: false,
          submittedAt: new Date('2025-01-01'),
          answers: [],
        },
      ];
      submissionsService.getSubmissionsByForm.mockResolvedValue(mockData);

      const result = await controller.getSubmissions('form123');

      expect(result).toEqual(mockData);
      expect(submissionsService.getSubmissionsByForm).toHaveBeenCalledWith(
        'form123',
      );
    });

    it('should return empty array when no submissions exist', async () => {
      submissionsService.getSubmissionsByForm.mockResolvedValue([]);

      const result = await controller.getSubmissions('empty-form');

      expect(result).toEqual([]);
    });
  });
});
