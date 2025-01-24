import {OpenAPIV3_1} from 'openapi-types';

interface JsdConstraints {
	format?: string;

	[key: string]: string | number | boolean;
}
export function SchemaJsdConstraints(oae: OpenAPIV3_1.SchemaObject) {
	const s: Record<string, string | number | boolean> = oae as any;
	return [
		/* These are just some of the format values possible:
			string:
				date,date-time,binary,byte,email,hostname,ipv4,ipv6,uri,uuid,regex,json-pointer,uri-reference,
			number:
				float,double,
			integer:
				int32,int64,
			custom:
				time,duration,
		 */
		'format',
		// numbers
		'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
		// strings
		'minLength', 'maxLength', 'pattern',
	].reduce((p, key) => {
		if (typeof s[key] !== 'undefined')
			p[key] = s[key];
		return p;
	}, {} as JsdConstraints);
}
