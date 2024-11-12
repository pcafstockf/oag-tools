import {Container} from 'async-injection';
import {CodeGenApiToken} from 'oag-shared/lang-neutral/api';
import {CodeGenOpenApiResponseToken} from 'oag-shared/lang-neutral/base';
import {CodeGenMethodToken} from 'oag-shared/lang-neutral/method';
import {CodeGenArrayModelToken, CodeGenPrimitiveModelToken, CodeGenRecordModelToken, CodeGenUnionModelToken} from 'oag-shared/lang-neutral/model';
import {CodeGenBodyParameterToken, CodeGenNamedParameterToken} from 'oag-shared/lang-neutral/parameter';
import {SourceGeneratorToken} from '../../source-generator';
import {beginTsMorphSetup, finishTsMorphSetup} from '../setup';
import {TsmorphServerApi} from './tsmorph-server-api';
import {TsmorphServerGenerator} from './tsmorph-server-generator';
import {TsmorphServerMethod} from './tsmorph-server-method';
import {TsmorphArrayServerModel, TsmorphPrimitiveServerModel, TsmorphRecordServerModel, TsmorphUnionServerModel} from './tsmorph-server-model';
import {TsmorphClinetNamedParameter, TsmorphServerBodyParameter} from './tsmorph-server-parameter';
import {TsmorphServerResponse} from './tsmorph-server-response';

export async function setupTsMorphServer(dic: Container, path: string[], obj: object): Promise<void> {
	// Prepare tsmorph code generation.
	await beginTsMorphSetup(dic, path, obj);

	// Now server specific stuff
	if (!dic.isIdKnown(CodeGenPrimitiveModelToken))
		dic.bindClass(CodeGenPrimitiveModelToken, TsmorphPrimitiveServerModel);
	if (!dic.isIdKnown(CodeGenArrayModelToken))
		dic.bindClass(CodeGenArrayModelToken, TsmorphArrayServerModel);
	if (!dic.isIdKnown(CodeGenRecordModelToken))
		dic.bindClass(CodeGenRecordModelToken, TsmorphRecordServerModel);
	if (!dic.isIdKnown(CodeGenUnionModelToken))
		dic.bindClass(CodeGenUnionModelToken, TsmorphUnionServerModel);
	if (!dic.isIdKnown(CodeGenApiToken))
		dic.bindClass(CodeGenApiToken, TsmorphServerApi);
	if (!dic.isIdKnown(CodeGenMethodToken))
		dic.bindClass(CodeGenMethodToken, TsmorphServerMethod);
	if (!dic.isIdKnown(CodeGenNamedParameterToken))
		dic.bindClass(CodeGenNamedParameterToken, TsmorphClinetNamedParameter);
	if (!dic.isIdKnown(CodeGenBodyParameterToken))
		dic.bindClass(CodeGenBodyParameterToken, TsmorphServerBodyParameter);
	if (!dic.isIdKnown(CodeGenOpenApiResponseToken))
		dic.bindClass(CodeGenOpenApiResponseToken, TsmorphServerResponse);

	// Now that we have all the server stuff in place
	await finishTsMorphSetup(dic, path, obj);

	if (!dic.isIdKnown(SourceGeneratorToken))
		dic.bindClass(SourceGeneratorToken, TsmorphServerGenerator);
}
