import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { UmojaApiModule } from './umoja-api.module';

/**
 * Bootstraps the Umoja API application with Fastify.
 * Listens on the port from process.env.port or 3000, bound to 0.0.0.0.
 *
 * @returns Promise that resolves when the server is listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    UmojaApiModule,
    new FastifyAdapter(),
  );
  await app.listen(process.env.port ?? 3000, '0.0.0.0');
}
bootstrap();
