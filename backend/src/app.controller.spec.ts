import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { describe, beforeEach, it, expect } from '@jest/globals';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getConnectionToken(),
          useValue: { readyState: 1 },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should report ok when the database is connected', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
    });

    it('should report degraded when the database is disconnected', async () => {
      const app: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          AppService,
          {
            provide: getConnectionToken(),
            useValue: { readyState: 0 },
          },
        ],
      }).compile();

      const degraded = app.get<AppController>(AppController);
      expect(degraded.getHealth().status).toBe('degraded');
    });
  });
});
