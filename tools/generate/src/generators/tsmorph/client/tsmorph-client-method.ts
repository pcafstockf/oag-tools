import {Inject, Injectable} from 'async-injection';
import {stringify as json5Stringify} from 'json5';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseNamedParameter, BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {isSchemaModel} from 'oag-shared/lang-neutral/model';
import {BodyParameter, NamedParameter} from 'oag-shared/lang-neutral/parameter';
import {MethodDeclaration, MethodSignature, Node, VariableDeclarationKind, VariableStatement} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';
import {bindAst, bindNext} from '../oag-tsmorph';
import {ApiClassDeclaration, ApiInterfaceDeclaration} from '../tsmorph-api';
import {BaseTsmorphMethod, MethodMethodDeclaration, MethodMethodSignature} from '../tsmorph-method';
import {isTsmorphModel, TsmorphModel} from '../tsmorph-model';
import {TsMorphParameter} from '../tsmorph-parameter';
import {TsmorphResponse} from '../tsmorph-response';

@Injectable()
export class TsmorphClientMethod extends BaseTsmorphMethod {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsmorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}

	private static DefinedHdrsName = 'hdrs';

	/**
	 * @inheritDoc
	 */
	protected async createTsMethod(alnType: LangNeutralApiTypes, owner: ApiInterfaceDeclaration | ApiClassDeclaration, id: string, params: TsMorphParameter[], responses: Map<string, TsmorphResponse>): Promise<MethodMethodSignature | MethodMethodDeclaration> {
		const rspModels = [] as TsmorphModel[];
		responses.forEach((v, k) => {
			if (k.startsWith('2') || k.startsWith('d') || k.startsWith('D'))
				if (isTsmorphModel(v.model))
					rspModels.push(v.model);
		});
		const rspTypeTxt = rspModels.map(m => m.getTypeNode().getText()).join(' | ') || 'void';
		let methods: (MethodDeclaration | MethodSignature)[];
		if (Node.isClassDeclaration(owner)) {
			const method = owner.addMethod({
				name: id,
			});
			methods = [
				method.addOverload({}),
				method.addOverload({}),
				method.addOverload({}),
				method.addOverload({}),
				method
			];
			const bodyParam = this.parameters.find(p => p.kind === 'body') as BodyParameter;
			if (bodyParam && this.baseSettings.role === 'client' && alnType === 'impl') {
				method.addBody();
				if (bodyParam.preferredMediaTypes[0])
					this.setPreDefinedHttpHeader(method, 'content-type', bodyParam.preferredMediaTypes[0]);
			}
		}
		else {
			methods = [
				owner.addMethod({
					name: id
				}),
				owner.addMethod({
					name: id
				}),
				owner.addMethod({
					name: id
				}),
				owner.addMethod({
					name: id
				})
			];
		}
		methods.forEach((meth, idx) => {
			params.forEach(param => {
				const p = meth.addParameter({
					name: param.getIdentifier(alnType),
					hasQuestionToken: !param.required,
					type: param.model.getTypeNode().getText()
				});
				bindAst(p, param);
			});
			switch (idx) {
				case 0:
					meth.setReturnType(`Promise<${rspTypeTxt}>`);
					break;
				case 1:
					meth.addParameter({
						name: 'rsp',
						hasQuestionToken: true,
						type: '\'http\''
					});
					meth.setReturnType(`Promise<HttpResponse<${rspTypeTxt}>>`);
					break;
				case 2:
					meth.addParameter({
						name: TsmorphClientMethod.DefinedHdrsName,
						hasQuestionToken: true,
						type: 'Record<string, string>'
					});
					meth.setReturnType(`Promise<${rspTypeTxt}>`);
					break;
				case 3:
					meth.addParameter({
						name: TsmorphClientMethod.DefinedHdrsName,
						hasQuestionToken: true,
						type: 'Record<string, string>'
					});
					meth.addParameter({
						name: 'rsp',
						hasQuestionToken: true,
						type: '\'http\''
					});
					meth.setReturnType(`Promise<HttpResponse<${rspTypeTxt}>>`);
					break;
				case 4:
					meth.addParameter({
						name: 'hdrsOrRsp',
						hasQuestionToken: true,
						type: 'Record<string, string> | \'body\' | \'http\''
					});
					meth.addParameter({
						name: 'rsp',
						type: '\'body\' | \'http\' | undefined',
						initializer: '\'body\''
					});
					meth.setReturnType(`Promise<${rspTypeTxt} | HttpResponse<${rspTypeTxt}>>`);
					break;
			}
			bindAst(meth.getReturnTypeNode(), rspModels);
			if (idx > 0)
				bindNext(methods[idx - 1], meth);
		});

		if (alnType === 'impl' && Node.isClassDeclaration(owner) && Node.isMethodDeclaration(methods[methods.length - 1]))
			this.populateMethodBody(methods[methods.length - 1] as MethodDeclaration);

		return bindAst(methods[0], this) as MethodMethodSignature | MethodMethodDeclaration;
	}

	protected populateMethodBody(impl: MethodDeclaration) {
		const definedHdrsStatement = impl.getStatement(s => {
			if (Node.isVariableStatement(s))
				return !!s.getDeclarations().find(d => d.getName() === TsmorphClientMethod.DefinedHdrsName);
			return false;
		}) as VariableStatement;
		const value = definedHdrsStatement?.getDeclarations().find(decl => decl.getName() === TsmorphClientMethod.DefinedHdrsName)?.getStructure()?.initializer;
		const pdHdrs = value ? JSON.parse(value as string) : {};  // A method with no body returning void will probably not have any predefined headers.
		const bodyMimeType = pdHdrs['content-type'];
		delete pdHdrs['content-type'];
		impl.setBodyText((writer) => {
			this.parameters.forEach((p) => {
				if (p.required) {
					const id = p.getIdentifier('intf');
					if (isSchemaModel(p) && p.nullable)
						writer.write(`if (typeof ${id} === 'undefined')`).writeLine(`throw new Error('Required parameter "${id}" is undefined');`);
					else
						writer.write(`if (${id} === null || typeof ${id} === 'undefined')`).writeLine(`throw new Error('Required parameter "${id}" is null/undefined');`);
				}
			});

			function makeSerializerInvocation(p: NamedParameter, arg?: string | boolean) {
				const key = p.serializerKey;
				if (!key)
					throw new Error(`Invalid style/explode serialization for ${p.name}@${(p as BaseNamedParameter).jsonPath}`);
				return `this.config.paramSerializers?.['${key}'](${p.getIdentifier('intf')}, ${typeof arg === 'string' ? '\'' + arg + '\'' : arg}) ?? ''`;
			}

			let pathPattern = this.pathPattern.replace(/{(.*?)}/g, (_, g) => '${' + makeSerializerInvocation(this.parameters.find(p => p.kind === 'named' && p.name === g) as NamedParameter, true) + '}');
			if (pathPattern[0] !== '/')
				pathPattern = '/' + pathPattern;
			writer.writeLine('let $serviceUrl = `${this.config.baseURL}' + pathPattern + '`;');
			writer.writeLine(`const $localHdrs = {} as Record<string,string>;`);
			writer.writeLine('if (hdrsOrRsp) {').indent();
			writer.indent().write('if (typeof hdrsOrRsp === ').quote('object').write(')');
			writer.indent().indent().writeLine(`Object.keys(hdrsOrRsp).forEach(v => {`)
				.writeLine(`$localHdrs[v.toLowerCase()] = hdrsOrRsp[v];`)
				.writeLine(`});`);
			writer.indent().write('else if (typeof hdrsOrRsp === ').quote('string').write(')');
			writer.indent().indent().writeLine(`rsp = hdrsOrRsp;`);
			writer.writeLine('}');
			writer.writeLine('else');
			writer.indent().write('rsp = ').quote('body').write(';');
			writer.newLine();

			Object.keys(pdHdrs).forEach(key => {
				writer.write('$localHdrs[').quote(key.toLowerCase()).write('] = ').quote(pdHdrs[key]).write(';');
			});
			const headerParams = this.parameters.filter(p => p.kind === 'named' && (p as NamedParameter).oae.in === 'header') as NamedParameter[];
			const queryParams = this.parameters.filter(p => p.kind === 'named' && (p as NamedParameter).oae.in === 'query') as NamedParameter[];
			const cookieParams = this.parameters.filter(p => p.kind === 'named' && (p as NamedParameter).oae.in === 'cookie') as NamedParameter[];
			const body = this.parameters.filter(p => p.kind === 'body')[0] as BodyParameter;
			headerParams.forEach(p => {
				if (!p.required)
					writer.writeLine(`if (typeof ${p.getIdentifier('intf')} !== 'undefined')`);
				writer.write('$localHdrs[').quote(p.name.toLowerCase()).write(`] = ${makeSerializerInvocation(p, false)};`);
			});
			if (!writer.isLastNewLine())
				writer.newLine();
			// JavaScript code in the browser has no control over cookie values, or even which cookies are sent, but node does.
			if (this.baseSettings.target !== 'browser') {
				writer.writeLine('const $cookies: Record<string, () => string> = {};');
				if (cookieParams.length > 0) {
					cookieParams.forEach(p => {
						if (!p.required)
							writer.writeLine(`if (typeof ${p.getIdentifier('intf')} !== 'undefined')`);
						writer.write(`$cookies[`).quote(p.name).write(`] = () => ${makeSerializerInvocation(p, p.name)};`);
					});
				}
			}
			if (queryParams.length > 0) {
				writer.writeLine('const $queries = [] as string[];');
				writer.writeLine(`const $addQueryIfValid = (s: string) => s && $queries.push(s);`);
				queryParams.forEach(p => {
					if (!p.required)
						writer.writeLine(`if (typeof ${p.getIdentifier('intf')} !== 'undefined')`);
					writer.writeLine(`$addQueryIfValid(${makeSerializerInvocation(p, p.name)});`);
				});
				writer.writeLine('if ($queries.length > 0)')
					.writeLine(`$serviceUrl += '?' + $queries.join('&');`);
			}
			writer.writeLine(`const $opDesc = {id:'${this.getIdentifier('intf')}', pattern:'${this.pathPattern}', method:'${this.httpMethod}'};`);
			if (body) {
				writer.write(`const $body = this.config.bodySerializer ? this.config.bodySerializer($opDesc, $serviceUrl, `).quote(bodyMimeType).write(`, ${body.getIdentifier('intf')}, $localHdrs) : ${body.getIdentifier('intf')};`);
				writer.newLine();
			}
			writer.write(`let $pre = this.config.enhanceReq ? this.config.enhanceReq($opDesc, $serviceUrl, $localHdrs`);
			if (this.baseSettings.target === 'browser')
				writer.write(`) : Promise.resolve(${cookieParams.length > 0 ? 'true' : ''});`);
			else
				writer.write(`, $cookies) : Promise.resolve($cookies);`);

			let sec = this.document.security ?? [];
			if (Array.isArray(this.oae.security))
				sec = this.oae.security;
			if (sec.length > 0) {
				writer.writeLine('if (this.config.ensureAuth) {')
					.writeLine(`const $security = ${json5Stringify(sec)} as any;`)
					.writeLine(`$pre = $pre.then(c => this.config.ensureAuth($opDesc, $security, $serviceUrl, $localHdrs, c));`)
					.writeLine('}');
			}
			writer.writeLine('const $rsp = $pre.then((c) => {');
			writer.writeLine('const $opts = {} as HttpOptions;');
			if (this.baseSettings.target === 'browser') {
				writer.writeLine('if (c)')
					.writeLine('$opts.credentials = c;');
			}
			else {
				writer.writeLine(`const $cookieEncoders = Object.values(c)`);
				writer.writeLine('if ($cookieEncoders.length > 0)')
					.write(`$localHdrs[`).quote('cookie').write(`] = ($localHdrs[`).quote('cookie').write(`] ? ($localHdrs[`).quote('cookie').write(`] + '; ') : '') + $cookieEncoders.map(fn => fn()).join('; ');`)
					.newLine();
			}
			writer.writeLine('if (Object.keys($localHdrs).length > 0)')
				.writeLine('$opts.headers = $localHdrs;');
			writer.write('return this.http.')
				.write(this.httpMethod.toLowerCase())
				.write('(')
				.write('$serviceUrl,');
			if (body)
				writer.write(`$body,`);
			writer.write('$opts);');
			writer.writeLine('});');
			writer.write('if (rsp !== \'http\')').indent().writeLine('return $rsp.then(r => r.data as any);');
			writer.writeLine('return $rsp;');
		});
	}

	protected setPreDefinedHttpHeader(impl: MethodDeclaration, key: string, value: string) {
		const definedHdrsStatement = this.ensurePreDefinedHdrsStatement(impl);
		const definedHdrsDecl = definedHdrsStatement.getDeclarations().find(decl => decl.getName() === TsmorphClientMethod.DefinedHdrsName);
		const struct = Object.assign({}, definedHdrsDecl.getStructure());
		const obj = JSON.parse(struct.initializer as string ?? '{}');
		obj[key] = value;
		struct.initializer = JSON.stringify(obj);
		definedHdrsDecl.set(struct);
	}

	private ensurePreDefinedHdrsStatement(impl: MethodDeclaration): VariableStatement {
		let definedHdrsStatement = impl.getStatement(s => {
			if (s instanceof VariableStatement)
				return !!s.getDeclarations().find(d => d.getName() === TsmorphClientMethod.DefinedHdrsName);
			return false;
		});
		if (!definedHdrsStatement) {
			definedHdrsStatement = impl.insertVariableStatement(0, {
				declarationKind: VariableDeclarationKind.Const,
				declarations: [{
					name: TsmorphClientMethod.DefinedHdrsName,
					type: 'Record<string,string>',
					initializer: '{}',
				}],
			});
		}
		return definedHdrsStatement as VariableStatement;
	}
}
