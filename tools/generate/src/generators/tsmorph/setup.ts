import {Container} from 'async-injection';
import {CodeGenCommonModelsToken, CodeGenPrimitiveModelToken, CodeGenTypedModelToken, CommonModelTypes} from 'oag-shared/lang-neutral/model';
import {TsmorphTypedModel} from './tsmorph-model';

let tsAny: TsmorphTypedModel;
let tsVoid: TsmorphTypedModel;
let tsUnknown: TsmorphTypedModel;

export async function beginTsMorphSetup(dic: Container, _path: string[], _obj: object): Promise<void> {
	if (!dic.isIdKnown(CodeGenCommonModelsToken))
		dic.bindConstant(CodeGenCommonModelsToken, (key: CommonModelTypes) => {
			switch (key) {
				case 'integer':
				case 'number':
				case 'string':
				case 'boolean':
				case 'null':
				case 'any':
				case 'object':
				case 'int32':
				case 'int64':
				case 'double':
				case 'float':
				case 'uri':
				case 'uri-reference':
					return dic.get(CodeGenPrimitiveModelToken);
				case 'byte':
					return dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).addOagType({ts: {type: 'ArrayBuffer', lib: undefined}});
				case 'binary':
					return dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).addOagType({ts: {type: 'Blob', lib: undefined}});
				case 'date':
				case 'date-time':
					return dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).addOagType({ts: {type: 'Date', lib: undefined}});
				case 'VOID':
					if (!tsVoid)
						tsVoid = dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).addOagType({ts: {type: 'void', lib: undefined}});
					return tsVoid;
				case 'ANY':
					if (!tsAny)
						tsAny = dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).addOagType({ts: {type: 'any', lib: undefined}});
					return tsAny;
				case 'UNKNOWN':
					if (!tsUnknown)
						tsUnknown = dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).addOagType({ts: {type: 'unknown', lib: undefined}});
					return tsUnknown;
				default:
					return null;
			}
		});
}

export async function finishTsMorphSetup(dic: Container, _path: string[], _obj: object): Promise<void> {
	if (!dic.isIdKnown(CodeGenTypedModelToken))
		dic.bindClass(CodeGenTypedModelToken, TsmorphTypedModel);
}
