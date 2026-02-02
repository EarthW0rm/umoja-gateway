/**
 * Injection token for the Strapi Control Plane base URL (without trailing slash).
 */
export const CONTROL_PLANE_STRAPI_BASE_URL = Symbol('CONTROL_PLANE_STRAPI_BASE_URL');

/**
 * Injection token for the Strapi Control Plane API token used for bearer authentication.
 */
export const CONTROL_PLANE_STRAPI_API_TOKEN = Symbol('CONTROL_PLANE_STRAPI_API_TOKEN');

/**
 * Injection token for the HTTP timeout (in milliseconds) applied to Strapi requests.
 */
export const CONTROL_PLANE_HTTP_TIMEOUT = Symbol('CONTROL_PLANE_HTTP_TIMEOUT');

/**
 * Injection token carrying the Control Plane Strapi options object.
 */
export const CONTROL_PLANE_STRAPI_OPTIONS = Symbol('CONTROL_PLANE_STRAPI_OPTIONS');
