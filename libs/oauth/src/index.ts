/**
 * @packageDocumentation
 * OAuth Nest Library: OAuth2 token issuance (password, client_credentials, refresh_token, authorization_code),
 * Bearer authentication, and route guards for NestJS with Fastify.
 * Export surface: OauthModule, OauthService, OauthController, guards, decorators, config tokens, interfaces, exceptions, utils.
 */
export * from './oauth.module';
export * from './oauth.service';
export * from './oauth.controller';
export * from './config';
export * from './exceptions';
export * from './interfaces';
export * from './interfaces/auth-repository.interface';
export * from './utils';
export * from './utils/pkce';
export * from './grant-types';
export * from './token-types';
export * from './response-types';
export * from './handlers';
export * from './oauth.guard';
export * from './guards';
export * from './decorators';
export * from './config';
