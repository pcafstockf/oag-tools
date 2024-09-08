import {Container} from 'async-injection';
import {CodeGenCommonModelsToken, CodeGenPrimitiveModelToken, Model} from 'oag-shared/lang-neutral';
import {BasePrimitiveModel} from '../base-model';
import {TsmorphCommonModels} from './tsmorph-model';

export async function beginTsMorphSetup(dic: Container, path: string[], obj: object): Promise<void> {
	if (!dic.isIdKnown(CodeGenCommonModelsToken))
		dic.bindConstant(CodeGenCommonModelsToken, {} as TsmorphCommonModels);
}

export async function finishTsMorphSetup(dic: Container, path: string[], obj: object): Promise<void> {
	const commonModels = dic.get(CodeGenCommonModelsToken);
	let pm: Model;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'null'});
	commonModels['void'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'null'});
	commonModels['undefined'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'null'});
	commonModels['any'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'null'});
	commonModels['null'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'boolean'});
	commonModels['boolean'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'string'});
	commonModels['string'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'number'});
	commonModels['number'] = pm;
	pm = dic.get<BasePrimitiveModel>(CodeGenPrimitiveModelToken).init(undefined, undefined, {type: 'integer'});
	commonModels['integer'] = pm;
}
