import {OpenAPIV3} from 'openapi-types';

export const HttpUpperVerbs = Object.keys(OpenAPIV3.HttpMethods) as string[];
export const HttpLowerVerbs = Object.values(OpenAPIV3.HttpMethods) as string[];
