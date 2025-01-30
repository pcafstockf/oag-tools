import {InjectionToken} from 'async-injection';
import {HttpClient} from './http-client';

export * from './client-types';
export * from './client-request';
export * from './client-config';
export * from './http-client';

export const ApiHttpClientToken = new InjectionToken<HttpClient>('ApiHttpClient');
