import {Container} from 'async-injection';
import {CodeGenCommonModelsToken, CodeGenPrimitiveModelToken, Model} from 'oag-shared/lang-neutral';
import {BasePrimitiveModel} from 'oag-shared/lang-neutral/base-model';
import {TsmorphCommonModels, TsmorphPrimitiveModel} from './tsmorph-model';

export async function beginTsMorphSetup(dic: Container, path: string[], obj: object): Promise<void> {
	if (!dic.isIdKnown(CodeGenCommonModelsToken))
		dic.bindConstant(CodeGenCommonModelsToken, {} as TsmorphCommonModels);
}

export async function finishTsMorphSetup(dic: Container, path: string[], obj: object): Promise<void> {
	const commonModels = dic.get(CodeGenCommonModelsToken);
	let pm: Model;
	pm = dic.get<TsmorphPrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'null'}).setTypeScriptType('void');
	commonModels['void'] = pm;
	pm = dic.get<TsmorphPrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'null'}).setTypeScriptType('undefined');
	commonModels['undefined'] = pm;
	pm = dic.get<TsmorphPrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: undefined}).setTypeScriptType('any');
	commonModels['any'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'null'});
	commonModels['null'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'boolean'});
	commonModels['boolean'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'string'});
	commonModels['string'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'number'});
	commonModels['number'] = pm;
	pm = dic.get<TsmorphPrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'integer'}).setTypeScriptType('number');
	commonModels['integer'] = pm;
}
