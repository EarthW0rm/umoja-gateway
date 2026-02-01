# OAuth Nest Library

This library is a NestJS-friendly TypeScript port of `@node-oauth/oauth2-server`.
It keeps the original OAuth2 flow logic while exposing Nest-friendly APIs,
TypeScript types, and Nest `HttpException`-based errors.

## Installation

Add the runtime dependencies to the workspace:

- `@node-oauth/formats`
- `basic-auth`
- `type-is`

## Usage

Register the module and provide a model implementation:

```ts
import { Module } from '@nestjs/common';
import { OauthModule } from '@oauth/oauth';

@Module({
  imports: [
    OauthModule.forRoot({
      model: {
        async getClient(clientId, clientSecret) {
          return { id: clientId, grants: ['authorization_code', 'refresh_token'] };
        },
        async saveToken(token, client, user) {
          return { ...token, client, user };
        },
        async getAccessToken(accessToken) {
          return { accessToken, client: { id: 'client' }, user: { id: 'user' } };
        },
        // implement required model methods for your grant types...
      },
    }),
  ],
})
export class AuthModule {}
```

## Request/Response Adapters

Use the request/response wrappers to decouple your controllers from the library:

```ts
import { Controller, Post, Req, Res } from '@nestjs/common';
import { OauthService, OAuthRequest, OAuthResponse } from '@oauth/oauth';
import type { Request, Response } from 'express';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauth: OauthService) {}

  @Post('token')
  async token(@Req() req: Request, @Res() res: Response) {
    const request = OAuthRequest.fromHttp(req);
    const response = new OAuthResponse();
    const token = await this.oauth.token(request, response);

    res.status(response.status ?? 200).set(response.headers ?? {}).json(token);
  }
}
```

## Error Handling

All library errors extend NestJS `HttpException`. You can catch them in
Nest exception filters or allow Nest to format the error response.
