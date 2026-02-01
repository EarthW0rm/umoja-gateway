import { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { UmojaApiModule } from '../../src/umoja-api.module';

export interface E2EContext {
  app: INestApplication;
  server: any;
  apiKey: string;
  createClient: (extra?: { userId?: string; grants?: string[]; scopes?: string[]; audiences?: string[] }) => Promise<{
    clientId: string;
    clientSecret: string;
    grants: string[];
    audiences?: string[];
  }>;
  createUser: (username: string, password: string, scopes?: string[]) => Promise<void>;
}

export async function bootstrapE2E(): Promise<E2EContext> {
  process.env.API_KEY = process.env.API_KEY ?? 'changeme';
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [UmojaApiModule],
  }).compile();

  const app = moduleFixture.createNestApplication(new FastifyAdapter());
  await app.init();
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer();
  const apiKey = process.env.API_KEY;

  const createClient = async (extra?: { userId?: string; grants?: string[]; scopes?: string[]; audiences?: string[] }) => {
    const res = await request(server)
      .post('/auth-demo/clients')
      .set('x-api-key', apiKey ?? 'changeme')
      .send({
        name: 'e2e-client',
        grants: extra?.grants ?? ['password', 'client_credentials', 'refresh_token'],
        userId: extra?.userId,
        scopes: extra?.scopes,
        audiences: extra?.audiences,
      })
      .expect(201);
    return res.body as { clientId: string; clientSecret: string; grants: string[]; audiences?: string[] };
  };

  const createUser = async (username: string, password: string, scopes: string[] = ['read']) => {
    await request(server)
      .post('/auth-demo/users')
      .set('x-api-key', apiKey ?? 'changeme')
      .send({ username, password, scopes })
      .expect(201);
  };

  return { app, server, apiKey: apiKey ?? 'changeme', createClient, createUser };
}
