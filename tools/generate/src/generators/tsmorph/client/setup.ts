import {Container} from 'async-injection';
import {CodeGenResponseToken} from 'oag-shared/lang-neutral';
import {CodeGenApiToken} from 'oag-shared/lang-neutral/api';
import {CodeGenMethodToken} from 'oag-shared/lang-neutral/method';
import {CodeGenArrayModelToken, CodeGenPrimitiveModelToken, CodeGenRecordModelToken} from 'oag-shared/lang-neutral/model';
import {CodeGenBodyParameterToken, CodeGenNamedParameterToken} from 'oag-shared/lang-neutral/parameter';
import {beginTsMorphSetup, finishTsMorphSetup} from '../setup';
import {TsmorphClientApi} from './tsmorph-client-api';
import {TsmorphClientMethod} from './tsmorph-client-method';
import {TsmorphArrayClientModel, TsmorphPrimitiveClientModel, TsmorphRecordClientModel} from './tsmorph-client-model';
import {TsmorphClientBodyParameter, TsmorphClinetNamedParameter} from './tsmorph-client-parameter';
import {TsmorphClientResponse} from './tsmorph-client-response';

export async function setupTsMorphClient(dic: Container, path: string[], obj: object): Promise<void> {
	// Prepare tsmorph code generation.
	await beginTsMorphSetup(dic, path, obj);

	// Now client specific stuff
	if (!dic.isIdKnown(CodeGenApiToken))
		dic.bindClass(CodeGenApiToken, TsmorphClientApi);
	if (!dic.isIdKnown(CodeGenMethodToken))
		dic.bindClass(CodeGenMethodToken, TsmorphClientMethod);
	if (!dic.isIdKnown(CodeGenPrimitiveModelToken))
		dic.bindClass(CodeGenPrimitiveModelToken, TsmorphPrimitiveClientModel);
	if (!dic.isIdKnown(CodeGenArrayModelToken))
		dic.bindClass(CodeGenArrayModelToken, TsmorphArrayClientModel);
	if (!dic.isIdKnown(CodeGenRecordModelToken))
		dic.bindClass(CodeGenRecordModelToken, TsmorphRecordClientModel);
	if (!dic.isIdKnown(CodeGenNamedParameterToken))
		dic.bindClass(CodeGenNamedParameterToken, TsmorphClinetNamedParameter);
	if (!dic.isIdKnown(CodeGenBodyParameterToken))
		dic.bindClass(CodeGenBodyParameterToken, TsmorphClientBodyParameter);
	if (!dic.isIdKnown(CodeGenResponseToken))
		dic.bindClass(CodeGenResponseToken, TsmorphClientResponse);

	// Now that we have all the client stuff in place
	await finishTsMorphSetup(dic, path, obj);
}
