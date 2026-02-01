import { Test, TestingModule } from '@nestjs/testing';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import { AuthModelModule } from './auth-model.module';
import { InMemoryAuthRepository } from './in-memory-auth.repository';

describe('AuthModelModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuthModelModule],
    }).compile();
  });

  it('provides AUTH_REPOSITORY as InMemoryAuthRepository', () => {
    const repo = module.get<InMemoryAuthRepository>(AUTH_REPOSITORY);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(InMemoryAuthRepository);
  });
});
