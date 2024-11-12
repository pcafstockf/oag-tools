import {Container} from 'async-injection';
import {CodeGenCommonModelsToken, CodeGenPrimitiveModelToken, CodeGenTypedModelToken, CommonModelTypes} from 'oag-shared/lang-neutral/model';
import {TsmorphTypedModel} from './tsmorph-model';

let tsAny: TsmorphTypedModel;
let tsVoid: TsmorphTypedModel;
let tsUnknown: TsmorphTypedModel;

export async function beginTsMorphSetup(dic: Container, path: string[], obj: object): Promise<void> {
	if (!dic.isIdKnown(CodeGenCommonModelsToken))
		dic.bindConstant(CodeGenCommonModelsToken, (key: CommonModelTypes) => {
			switch (key) {
				case 'integer':
				case 'number':
				case 'string':
				case 'boolean':
				case 'null':
				case 'any':
					return dic.get(CodeGenPrimitiveModelToken);
				case 'object':
					return dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).setTypeName('Object');
				case 'int32':
				case 'int64':
				case 'double':
				case 'float':
					return dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).setTypeName('number');
				case 'binary':
					return dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).setTypeName('Blob');
				case 'date':
				case 'date-time':
					return dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).setTypeName('Date');
				case 'VOID':
					if (!tsVoid)
						tsVoid = dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).setTypeName('void');
					return tsVoid;
				case 'ANY':
					if (!tsAny)
						tsAny = dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).setTypeName('any');
					return tsAny;
				case 'UNKNOWN':
					if (!tsUnknown)
						tsUnknown = dic.get<TsmorphTypedModel>(CodeGenTypedModelToken).setTypeName('unknown');
					return tsUnknown;
				default:
					return null;
			}
		});
}

export async function finishTsMorphSetup(dic: Container, path: string[], obj: object): Promise<void> {
	if (!dic.isIdKnown(CodeGenTypedModelToken))
		dic.bindClass(CodeGenTypedModelToken, TsmorphTypedModel);
}
