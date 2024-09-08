import {InjectableId} from 'async-injection';
import {RegisterConfigMarker} from 'dyflex-config';

export const ClientSettings = {
	[RegisterConfigMarker]: 'CODE_GEN_CLIENT',

	// Ordered list of request MediaTypes (RegEx allowed) which the code generator can use to choose a RequestBodyObject from the content types in an OperationObject.
	// See: https://dev.to/bcanseco/request-body-encoding-json-x-www-form-urlencoded-ad9
	reqMediaTypes: [
		'application/x-www-form-urlencoded',
		'multipart/form-data',
		'application/octet-stream',
		'application/json',
		'text/plain',
		'application/xml',
	],
	// Keep in mind that every response will be processed by the http-client, this simply helps define the preferred 'body' response type.
	acceptMediaTypes: [
		'application/octet-stream',
		'application/json',
		'text/plain'
	],
	libs: {
		xml: undefined as string
	}
};

export type ClientSettingsType = Omit<typeof ClientSettings, '__conf_register'>;
export const ClientSettingsToken = Symbol.for(ClientSettings[RegisterConfigMarker]) as InjectableId<ClientSettingsType>;

