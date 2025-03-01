import {Inject, Injectable} from 'async-injection';
import path from 'node:path';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {interpolateBashStyle} from 'oag-shared/utils/misc-utils';
import {isValidJsIdentifier} from 'oag-shared/utils/name-utils';
import {MethodDeclaration, ObjectLiteralExpression, Scope, StructureKind, SyntaxKind} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphServerSettingsToken, TsMorphServerSettingsType} from '../../../settings/tsmorph-server';
import {bindAst, importIfNotSameFile} from '../oag-tsmorph';
import {ApiClassDeclaration,} from '../tsmorph-api';
import {BaseTsmorphMethod, MethodMethodDeclaration, TsmorphMethod} from '../tsmorph-method';
import {isTsmorphModel, TsmorphModel} from '../tsmorph-model';
import {isTsmorphParameter, TsMorphParameter} from '../tsmorph-parameter';
import {TsmorphResponse} from '../tsmorph-response';
import {ApiFunctionDeclaration} from './tsmorph-server-api';

export interface TsmorphServerMethodType extends TsmorphMethod<ApiClassDeclaration, ApiClassDeclaration, MethodMethodDeclaration, MethodMethodDeclaration> {
	generate(alnType: 'intf', api: ApiClassDeclaration): Promise<MethodMethodDeclaration>;

	generate(alnType: 'impl', api: ApiClassDeclaration): Promise<MethodMethodDeclaration>;

	generate(alnType: 'hndl', api: ApiFunctionDeclaration): Promise<MethodObjectLiteralExpression>;
}

export interface MethodObjectLiteralExpression extends ObjectLiteralExpression {
	readonly $ast?: TsmorphMethod<any, any, any, any>;
}

@Injectable()
export class TsmorphServerMethod extends BaseTsmorphMethod<ApiClassDeclaration, ApiClassDeclaration, MethodMethodDeclaration, MethodMethodDeclaration> implements TsmorphServerMethodType {
	constructor(
		@Inject(BaseSettingsToken)
		baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
		tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphServerSettingsToken)
		protected tsMorphServerSettings: TsMorphServerSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}

	generate(alnType: 'intf', api: ApiClassDeclaration): Promise<MethodMethodDeclaration>;
	generate(alnType: 'impl', api: ApiClassDeclaration): Promise<MethodMethodDeclaration>;
	generate(alnType: 'hndl', api: ApiFunctionDeclaration): Promise<MethodObjectLiteralExpression>;
	async generate(alnType: 'intf' | 'impl' | 'hndl', api: ApiClassDeclaration | ApiFunctionDeclaration): Promise<MethodMethodDeclaration | MethodObjectLiteralExpression> {
		switch (alnType) {
			case 'intf':
				return super.generate(alnType, api as ApiClassDeclaration);
			case 'impl':
				return super.generate(alnType, api as ApiClassDeclaration);
			case 'hndl':
				return bindAst(this.createHndlLiteral(api as ApiFunctionDeclaration), this) as MethodObjectLiteralExpression;
		}
	}

	protected async createTsMethod(alnType: LangNeutralApiTypes, owner: ApiClassDeclaration | ApiFunctionDeclaration, id: string, params: TsMorphParameter[], responses: Map<string, TsmorphResponse>): Promise<MethodMethodDeclaration> {
		const rspModels = [] as TsmorphModel[];
		responses.forEach((v, k) => {
			if (k.startsWith('2') || k.startsWith('d') || k.startsWith('D'))
				if (isTsmorphModel(v.model))
					rspModels.push(v.model);
		});
		const rspTypeTxt = rspModels.map(m => m.getTypeNode().getText()).join(' | ') || 'void';
		const returnType = `Promise<HttpResponse<${rspTypeTxt}>>`;
		let meth: MethodDeclaration;
		switch (alnType) {
			case 'intf':
				meth = (owner as ApiClassDeclaration).addMethod({
					name: id,
					isAbstract: true,
					scope: Scope.Public,
					returnType: returnType
				});
				break;
			case 'impl':
				meth = (owner as ApiClassDeclaration).addMethod({
					name: id,
					hasOverrideKeyword: true,
					scope: Scope.Public,
					returnType: returnType,
					docs: [{
						kind: StructureKind.JSDoc,
						tags: [{
							kind: StructureKind.JSDocTag,
							tagName: 'inheritDoc'
						}]
					}]
				});
				this.populateMethodBody(meth);
				break;
		}
		params.forEach(param => {
			const p = meth.addParameter({
				name: param.getIdentifier(alnType),
				hasQuestionToken: !param.required,
				type: param.model.getTypeNode().getText()
			});
			bindAst(p, param);
		});
		return bindAst(meth, this) as MethodMethodDeclaration;
	}

	protected populateMethodBody(impl: MethodDeclaration) {
		let retValStr = this.tsMorphServerSettings[this.tsMorphServerSettings.framework].stubReturn;
		impl.setIsAsync(retValStr.trim() !== 'null');
		impl.setBodyText(`return ${retValStr};`);
	}

	protected createHndlLiteral(hndl: ApiFunctionDeclaration): ObjectLiteralExpression {
		const intf = hndl.$ast.getLangNode('intf');
		const sf = hndl.getSourceFile();
		const retStat = hndl.getStatements()[0].asKind(SyntaxKind.ReturnStatement);
		const retExp = retStat.getExpression().asKind(SyntaxKind.AsExpression);
		const objLit = retExp ? retExp.getExpression().asKind(SyntaxKind.AsExpression).getExpression().asKind(SyntaxKind.ObjectLiteralExpression) : retStat.getExpression().asKind(SyntaxKind.ObjectLiteralExpression);

		this.createAdapterMember(objLit);

		importIfNotSameFile(hndl, intf, intf.getName());
		const intfDir = path.relative(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiHndlDir), path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir));
		const intDir = path.relative(intfDir, this.tsMorphServerSettings.internalDirName);
		const framework = this.tsMorphServerSettings[this.tsMorphServerSettings.framework];
		framework.hndl.imphorts.map(i => {
			return {
				moduleSpecifier: interpolateBashStyle(i.moduleSpecifier, {internal: intDir}),
				namedImports: i.namedImports
			};
		}).forEach(i => sf.addImportDeclaration(i));

		// By the time we get here, it is difficult to retrieve the original return types of the API methods.
		// So, we just pull in everything that the interface itself needed and let source code reformat / cleanup deal with extras.
		const intfSF = intf.getSourceFile();
		intfSF.getImportDeclarations().forEach(i => {
			const s = i.getStructure();
			if (s.moduleSpecifier.startsWith('.')) {
				sf.addImportDeclaration({
					moduleSpecifier: path.relative(intfDir, s.moduleSpecifier),
					namedImports: s.namedImports
				});
			}
		});
		return objLit;
	}

	protected createAdapterMember(adapter: ObjectLiteralExpression) {
		const framework = this.tsMorphServerSettings[this.tsMorphServerSettings.framework];
		const genericParams = {body: 'never', path: [], query: [], header: [], cookie: [], reply: 'never', oaVers: this.document.openapi, apiInvocation: undefined} as any;
		const resolver = framework.hndl.lookup as { [key: keyof typeof genericParams]: string };
		genericParams.apiInvocation = this.parameters.reduce((s, p, idx) => {
			let ref: string;
			if (isTsmorphParameter(p) && isTsmorphModel(p.model)) {
				p.model.importInto(adapter.getSourceFile());
				let typeStr = p.model.getTypeNode().getText();
				if (p.kind === 'body') {
					ref = resolver.body;
					genericParams.body = typeStr;
				}
				else if (p.kind === 'named') {
					const loc = p.oae.in as keyof typeof genericParams;
					if (resolver[loc]) {
						let jsId = p.name;
						ref = interpolateBashStyle(resolver[loc], {name: p.name, type: typeStr});
						if (!isValidJsIdentifier(jsId)) {
							if (ref.endsWith('.' + jsId) || ref.indexOf('.' + jsId + ' as ') > 0)
								ref = ref.replace('.' + jsId, `['${jsId}']`);
							jsId = `['${jsId}']`;
						}
						genericParams[loc].push(`${jsId}:${typeStr}`);
					}
				}
			}
			if (ref)
				s += (idx > 0 ? ',' : '') + ' ' + ref;
			return s;
		}, `api.${this.getIdentifier('intf')}(`) + ')';
		Object.keys(genericParams).forEach(key => {
			if (Array.isArray(genericParams[key])) {
				if (genericParams[key].length === 0)
					genericParams[key] = 'never';
				else
					genericParams[key] = `{${genericParams[key].join(',')}}`;
			}
		});
		const rspModels = [] as TsmorphModel[];
		this.responses.forEach((v, k) => {
			if (k.startsWith('2') || k.startsWith('d') || k.startsWith('D'))
				if (isTsmorphModel(v.model))
					rspModels.push(v.model);
		});
		const rspTypeTxt = rspModels.map(m => m.getTypeNode().getText()).join(' | ') || 'void';
		if (rspTypeTxt && rspTypeTxt !== 'void')
			genericParams.reply = rspTypeTxt;

		const initTxt = interpolateBashStyle(framework.hndl.body, genericParams);
		const opNameData = {name: this.getIdentifier('intf'), pattern: this.pathPattern.toLowerCase(), method: this.httpMethod.toUpperCase(), operationId: this.oae.operationId};
		const operationIdName = interpolateBashStyle(framework.hndl.operationId ?? this.getIdentifier('intf'), opNameData);
		const operationId = adapter.addPropertyAssignment({
			name: operationIdName,
			initializer: initTxt
		});
		bindAst(operationId, this);
		const arrowFn = operationId.getInitializer().asKind(SyntaxKind.ArrowFunction);
		bindAst(arrowFn, this);
	}
}
