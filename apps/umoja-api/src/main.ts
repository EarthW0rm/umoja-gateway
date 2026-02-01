import { NestFactory } from '@nestjs/core';
import { UmojaApiModule } from './umoja-api.module';

async function bootstrap() {
  const app = await NestFactory.create(UmojaApiModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
