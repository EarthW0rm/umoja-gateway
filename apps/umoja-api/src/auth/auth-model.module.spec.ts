import { Test } from '@nestjs/testing';
import { AUTH_REPOSITORY } from '@oauth/oauth';
import { AuthModelModule } from './auth-model.module';
import { InMemoryAuthRepository } from '@control-plane/control-plane';

describe('AuthModelModule', () => {
  let module: any;

  beforeEach(async () => {
    process.env.CONTROL_PLANE_STRAPI_BASE_URL = 'http://localhost:1337';
    process.env.CONTROL_PLANE_STRAPI_API_TOKEN = 'test-token';

    const testingModuleBuilder = Test.createTestingModule({
      imports: [AuthModelModule],
    }).overrideProvider(AUTH_REPOSITORY);

    module = await testingModuleBuilder.useValue(new InMemoryAuthRepository()).compile();
  });

  it('provides AUTH_REPOSITORY after override', () => {
    const repo = module.get(AUTH_REPOSITORY);
    expect(repo).toBeDefined();
  });
});
