import {Container} from 'async-injection';
import {CodeGenApiToken} from 'oag-shared/lang-neutral/api';
import {CodeGenOpenApiResponseToken} from 'oag-shared/lang-neutral/base';
import {CodeGenMethodToken} from 'oag-shared/lang-neutral/method';
import {CodeGenArrayModelToken, CodeGenPrimitiveModelToken, CodeGenRecordModelToken, CodeGenUnionModelToken} from 'oag-shared/lang-neutral/model';
import {CodeGenBodyParameterToken, CodeGenNamedParameterToken} from 'oag-shared/lang-neutral/parameter';
import {SourceGeneratorToken} from '../../source-generator';
import {beginTsMorphSetup, finishTsMorphSetup} from '../setup';
import {TsmorphClientApi} from './tsmorph-client-api';
import {TsmorphClientGenerator} from './tsmorph-client-generator';
import {TsmorphClientMethod} from './tsmorph-client-method';
import {TsmorphArrayClientModel, TsmorphPrimitiveClientModel, TsmorphRecordClientModel, TsmorphUnionClientModel} from './tsmorph-client-model';
import {TsmorphClientBodyParameter, TsmorphClinetNamedParameter} from './tsmorph-client-parameter';
import {TsmorphClientResponse} from './tsmorph-client-response';

export async function setupTsMorphClient(dic: Container, path: string[], obj: object): Promise<void> {
	// Prepare tsmorph code generation.
	await beginTsMorphSetup(dic, path, obj);

	// Now client specific stuff
	if (!dic.isIdKnown(CodeGenPrimitiveModelToken))
		dic.bindClass(CodeGenPrimitiveModelToken, TsmorphPrimitiveClientModel);
	if (!dic.isIdKnown(CodeGenArrayModelToken))
		dic.bindClass(CodeGenArrayModelToken, TsmorphArrayClientModel);
	if (!dic.isIdKnown(CodeGenRecordModelToken))
		dic.bindClass(CodeGenRecordModelToken, TsmorphRecordClientModel);
	if (!dic.isIdKnown(CodeGenUnionModelToken))
		dic.bindClass(CodeGenUnionModelToken, TsmorphUnionClientModel);
	if (!dic.isIdKnown(CodeGenApiToken))
		dic.bindClass(CodeGenApiToken, TsmorphClientApi);
	if (!dic.isIdKnown(CodeGenMethodToken))
		dic.bindClass(CodeGenMethodToken, TsmorphClientMethod);
	if (!dic.isIdKnown(CodeGenNamedParameterToken))
		dic.bindClass(CodeGenNamedParameterToken, TsmorphClinetNamedParameter);
	if (!dic.isIdKnown(CodeGenBodyParameterToken))
		dic.bindClass(CodeGenBodyParameterToken, TsmorphClientBodyParameter);
	if (!dic.isIdKnown(CodeGenOpenApiResponseToken))
		dic.bindClass(CodeGenOpenApiResponseToken, TsmorphClientResponse);

	// Now that we have all the client stuff in place
	await finishTsMorphSetup(dic, path, obj);

	if (!dic.isIdKnown(SourceGeneratorToken))
		dic.bindClass(SourceGeneratorToken, TsmorphClientGenerator);
}
