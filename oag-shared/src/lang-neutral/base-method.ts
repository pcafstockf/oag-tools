import os from 'node:os';
import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import * as nameUtils from '../utils/name-utils';
import {BaseIdentifiedLangNeutral} from './base-lang-neutral';
import {BaseParameter} from './base-parameter';
import {BaseSettingsType} from './base-settings';
import {CodeGenMethodToken, Method} from './method';
import {Response} from './response';

export abstract class BaseMethod<LANG_REF extends any = unknown> extends BaseIdentifiedLangNeutral<OpenAPIV3_1.OperationObject, LANG_REF> implements Method<LANG_REF> {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	/**
	 * @inheritDoc
	 * WARNING:
	 *  Even though 'pathItem' is declared as optional (to keep TypeScript happy wrt inheritance), it is not optional.
	 *  Indeed our interface declaration lists it as required.
	 */
	init(doc: OpenAPIV3_1.Document, jsonPath: string, operation: OpenAPIV3_1.OperationObject, pathItem?: OpenAPIV3_1.PathItemObject): void {
		const lastSep = jsonPath.lastIndexOf('/');
		this.#httpMethod = jsonPath.substring(lastSep + 1);
		const secondLastSep = jsonPath.lastIndexOf('/', lastSep - 1);
		this.#pathPattern = jsonPath.substring(secondLastSep + 1, lastSep);
		this.#pathItem = pathItem;
		super.init(doc, jsonPath, operation);
	}

	#pathPattern: string;
	#httpMethod: string;
	#pathItem: OpenAPIV3_1.PathItemObject;

	/**
	 * This will be in the form of a uri template friendly path (not a json pointer format).
	 */
	get pathPattern(): string {
		// Unescape, and then drop the leading slash.
		return this.#pathPattern.replaceAll('~1', '/').replaceAll('~0', '~').slice(1);
	}

	/**
	 * GET, PUT, etc (always upper case).
	 */
	get httpMethod(): string {
		return this.#httpMethod.toUpperCase();
	}

	abstract getType(type: string): LANG_REF;

	getIdentifier(type: 'intf' | 'impl' | 'hndl'): string {
		return this.toOperationName(this.ensureOperationId());
	}

	protected ensureOperationId(): string {
		let id = this.oae.operationId;
		if (!id)
			id = nameUtils.setCase(this.#httpMethod + ' ' + this.#pathPattern, 'snake');
		return id;
	}

	addParameter(param: BaseParameter<unknown>): void {
		if (!this.#parameters)
			this.#parameters = [];
		this.#parameters.push(param);
	}

	#parameters: BaseParameter<unknown>[];

	get parameters(): BaseParameter<unknown>[] {
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

export const BaseMethodToken = CodeGenMethodToken as InjectionToken<BaseMethod>;
