import {Container} from 'async-injection';
import {Injector} from 'async-injection/lib/injector';
import {CodeGenApiToken} from 'oag-shared/lang-neutral/api';
import {BaseSettingsToken, CodeGenOpenApiResponseToken, CodeGenSyntheticModelToken, Model} from 'oag-shared/lang-neutral/base';
import {CodeGenMethodToken} from 'oag-shared/lang-neutral/method';
import {CodeGenArrayModelToken, CodeGenMixedModelToken, CodeGenPrimitiveModelToken, CodeGenRecordModelToken, CombinedModelKind} from 'oag-shared/lang-neutral/model';
import {CodeGenBodyParameterToken, CodeGenNamedParameterToken} from 'oag-shared/lang-neutral/parameter';
import {TsMorphSettingsToken} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken} from '../../../settings/tsmorph-client';
import {beginTsMorphSetup, finishTsMorphSetup} from '../setup';
import {TsmorphClientApi} from './tsmorph-client-api';
import {TsmorphClientMethod} from './tsmorph-client-method';
import {TsmorphArrayClientModel, TsmorphMixedClientModel, TsmorphPrimitiveClientModel, TsmorphRecordClientModel, TsmorphSyntheticClientModel} from './tsmorph-client-model';
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
	if (!dic.isIdKnown(CodeGenMixedModelToken))
		dic.bindFactory(CodeGenMixedModelToken, (injector: Injector) => {
			return (kind: CombinedModelKind) => {
				return new TsmorphMixedClientModel(injector.get(BaseSettingsToken), kind, injector.get(TsMorphSettingsToken), injector.get(TsMorphClientSettingsToken))
			}
		});
	if (!dic.isIdKnown(CodeGenSyntheticModelToken))
		dic.bindFactory(CodeGenSyntheticModelToken, (injector: Injector) => {
			return (kind: CombinedModelKind) => {
				return new TsmorphSyntheticClientModel(injector.get(BaseSettingsToken), kind, injector.get(TsMorphSettingsToken), injector.get(TsMorphClientSettingsToken))
			}
		});
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
}
