import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { UmojaApiModule } from './../src/umoja-api.module';

describe('App bootstrap (umoja-api)', () => {
  let app: INestApplication;

  it('starts the Nest application', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UmojaApiModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.close();
  });
});
