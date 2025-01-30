import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseOpenApiResponse, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {OpenApiResponse} from 'oag-shared/lang-neutral/response';
import {ReturnTypedNode} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';

export interface TsmorphResponse extends OpenApiResponse {
	getLangNode(alnType: LangNeutralApiTypes): ResponseReturnTypedNode;
}

export abstract class BaseTsmorphResponse extends BaseOpenApiResponse {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
		this.#tsTypes = {} as any;
	}

	readonly #tsTypes: {
		intf: ResponseReturnTypedNode,
		impl: ResponseReturnTypedNode,
		hndl: ResponseReturnTypedNode
		mock: ResponseReturnTypedNode
	};

	getLangNode(type: 'intf'): ResponseReturnTypedNode;
	getLangNode(type: 'impl' | 'hndl' | 'mock'): ResponseReturnTypedNode;
	getLangNode(type: LangNeutralApiTypes): ResponseReturnTypedNode;
	override getLangNode(type: LangNeutralApiTypes): ResponseReturnTypedNode {
		return this.#tsTypes[type];
	}

	/**
	 * Client side helper to find the 2xx response types from the server.
	 * WARNING:
	 *  Due to nesting of media types within response codes, there is *not* a one to one correlation between the supplied 'accept' headers and the returned types.
	getAcceptableTypes(): TsmorphModel[] {
		const accept = this.getAcceptable(true);
		const schemas: TypeSchema[] = [];
		let hasAny = false;
		let hasVoid = accept.length === 0;
		const codes = this.preferredResponses.map(r => r.code);
		codes.forEach(rspCode => {
			const rsp = resolveIfRef<TargetOpenAPI.ResponseObject>(this.oae[rspCode]).obj;
			if (rsp.content) {
				Object.keys(rsp.content).forEach((mediaType) => {
					if (mediaType === '* /*')
						hasAny = true;
					else if (accept.indexOf(mediaType) >= 0) {
						const mtObj = resolveIfRef<TargetOpenAPI.MediaTypeObject>(rsp.content[mediaType]).obj;
						if (!mtObj.schema)
							hasVoid = true;
						else {
							const cs = (mtObj.schema as OpenAPISchemaObject).$ast;
							const match = schemas.find(s => s.matches(cs));
							if (!match)
								schemas.push(cs);
						}
					}
				});
			}
		});
		if (hasAny)
			schemas.push(null);
		if (hasVoid)
			schemas.push(undefined);
		return schemas;
	}
	 */
}

export function isTsmorphResponse(obj: any): obj is TsmorphResponse {
	if (obj)
		if (obj instanceof BaseTsmorphResponse)
			return true;
	return false;
}

interface ResponseReturnTypedNode extends ReturnTypedNode {
	readonly $ast?: TsmorphResponse;
}
