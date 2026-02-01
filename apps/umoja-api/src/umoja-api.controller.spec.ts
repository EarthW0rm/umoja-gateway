import { Test, TestingModule } from '@nestjs/testing';
import { UmojaApiController } from './umoja-api.controller';
import { UmojaApiService } from './umoja-api.service';

describe('UmojaApiController', () => {
  let umojaApiController: UmojaApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UmojaApiController],
      providers: [UmojaApiService],
    }).compile();

    umojaApiController = app.get<UmojaApiController>(UmojaApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(umojaApiController.getHello()).toBe('Hello World!');
    });
  });
});
