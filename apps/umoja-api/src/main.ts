import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { UmojaApiModule } from './umoja-api.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    UmojaApiModule,
    new FastifyAdapter(),
  );
  await app.listen(process.env.port ?? 3000, '0.0.0.0');
}
bootstrap();
