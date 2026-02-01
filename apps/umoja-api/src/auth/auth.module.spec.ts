import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { AuthExampleController } from './auth.controller';
import { AuthExampleService } from './auth.service';

describe('AuthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
  });

  it('compiles and exposes AuthExampleController', () => {
    const controller = module.get<AuthExampleController>(AuthExampleController);
    expect(controller).toBeDefined();
  });

  it('provides AuthExampleService', () => {
    const service = module.get<AuthExampleService>(AuthExampleService);
    expect(service).toBeDefined();
  });
});
