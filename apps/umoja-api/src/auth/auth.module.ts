import { Module } from '@nestjs/common';
import { OauthModule } from '@oauth/oauth';
import { InMemoryOAuthModel } from './auth.model';
import { AuthExampleService } from './auth.service';
import { AuthExampleController } from './auth.controller';
import { AuthModelModule } from './auth-model.module';

@Module({
  imports: [
    AuthModelModule,
    OauthModule.forRootAsync({
      imports: [AuthModelModule],
      useFactory: (model: InMemoryOAuthModel) => ({
        model,
        includeControllers: true,
      }),
      inject: [InMemoryOAuthModel],
    }),
  ],
  controllers: [AuthExampleController],
  providers: [AuthExampleService],
  exports: [AuthModelModule],
})
export class AuthModule {}
