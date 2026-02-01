import { Module } from '@nestjs/common';
import { AuthRepository, OauthModule } from '@oauth/oauth';
import { AuthExampleService } from './auth.service';
import { AuthExampleController } from './auth.controller';
import { AuthModelModule } from './auth-model.module';
import { AUTH_REPOSITORY } from '@oauth/oauth';

@Module({
  imports: [
    AuthModelModule,
    OauthModule.forRootAsync({
      imports: [AuthModelModule],
      useFactory: (authRepository: AuthRepository) => ({
        model: authRepository,
        includeControllers: false,
        token: {
          accessTokenLifetime: 30 * 60, // 30 minutos
          refreshTokenLifetime: 7 * 24 * 60 * 60, // 7 dias
          alwaysIssueNewRefreshToken: true,
          jwt: {
            issuer: 'umoja-api',
            audience: 'umoja-clients',
            secret: 'demo-access-token-secret',
            algorithm: 'HS256',
            keyId: 'umoja-access-key',
          },
        },
      }),
      inject: [AUTH_REPOSITORY],
    }),
  ],
  controllers: [AuthExampleController],
  providers: [AuthExampleService],
  exports: [AuthModelModule],
})
export class AuthModule {}
