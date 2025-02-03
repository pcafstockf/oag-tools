import os from 'node:os';
import {OpenAPIV3_1} from 'openapi-types';
import {ReadonlyDeep} from 'type-fest';
import * as nameUtils from '../../utils/name-utils';
import {LangNeutralApiTypes} from '../api';
import {Method} from '../method';
import {Parameter} from '../parameter';
import {Response} from '../response';
import {BaseSettingsType} from '../settings';
import {BaseLangNeutral, BaseLangNeutralConstructor, MixOpenApiLangNeutral} from './base-lang-neutral';

export abstract class BaseMethod extends MixOpenApiLangNeutral<OpenAPIV3_1.OperationObject, Method, BaseLangNeutralConstructor>(BaseLangNeutral as BaseLangNeutralConstructor) implements Method {
	// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	init(doc: OpenAPIV3_1.Document, jsonPath: string, operation: OpenAPIV3_1.OperationObject, pathItem: OpenAPIV3_1.PathItemObject): void {
		this.setOae(operation);
		const lastSep = jsonPath.lastIndexOf('/');
		this.#httpMethod = jsonPath.substring(lastSep + 1);
		const secondLastSep = jsonPath.lastIndexOf('/', lastSep - 1);
		this.#pathPattern = jsonPath.substring(secondLastSep + 1, lastSep);
		this.#pathItem = pathItem;
		this.#document = doc;
	}

	#pathPattern: string;
	#httpMethod: string;
	#pathItem: OpenAPIV3_1.PathItemObject;
	#document: OpenAPIV3_1.Document;

	get document(): ReadonlyDeep<OpenAPIV3_1.Document> {
		return this.#document;
	}

	/**
	 * This will be in the form of a uri template friendly path (not a json pointer format).
	 */
	get pathPattern(): string {
		// Unescape, and then drop the leading slash.
		return this.#pathPattern.replaceAll('~1', '/').replaceAll('~0', '~').slice(1);
	}

	/**
	 * GET, PUT, etc. (always upper case).
	 */
	get httpMethod(): string {
		return this.#httpMethod.toUpperCase();
	}

	getIdentifier(_type: LangNeutralApiTypes): string {
		return this.toOperationName(this.ensureOperationId());
	}

	protected ensureOperationId(): string {
		let id = this.oae.operationId;
		if (!id)
			id = nameUtils.setCase(this.#httpMethod + ' ' + this.#pathPattern, 'snake');
		return id;
	}

	addParameter(param: Parameter): void {
		if (!this.#parameters)
			this.#parameters = [];
		this.#parameters.push(param);
	}

	#parameters: Parameter[];

	get parameters(): Parameter[] {
		return this.#parameters?.slice(0) ?? [];
	}

	addResponse(code: string, rsp: Response): void {
		if (!this.#responses)
			this.#responses = new Map<string, Response>();
		this.#responses.set(code, rsp);
	}

	#responses: Map<string, Response>;

	get responses(): ReadonlyMap<string, Response> {
		return this.#responses;
	}

	toString() {
		let retVal = `${this.getIdentifier('intf')}(`;
		this.parameters.forEach((p, i) => {
			if (i > 0)
				retVal += ', ';
			retVal += p.getIdentifier('intf');
			if (!p.required)
				retVal += '?';
			retVal += ':';
			if (p.model)
				retVal += (p.model.toString as any)(true);
		});
		retVal += ') -> ';
		const responses = this.responses;
		const rspCodes = Array.from(responses.keys());
		let rspTxt = rspCodes.reduce((p, code, i) => {
			let modelTxt = 'void';
			const rsp = responses.get(code);
			if (rsp.model) {
				modelTxt = (rsp.model.toString as any)(true);
				if (modelTxt)
					modelTxt = modelTxt.replaceAll(/[\r?\n]+/g, `${os.EOL}\t`);
			}
			if (i === 0)
				p += `{${code}:`;
			else
				p += `; ${code}:`;
			p += modelTxt;
			return p;
		}, '');
		if (rspTxt)
			rspTxt += '}';
		else
			rspTxt = 'void';
		return retVal + rspTxt;
	}
}
