import {MethodDeclaration, MethodSignature} from 'ts-morph';
import {BaseSettingsType} from 'oag-shared/lang-neutral/base-settings';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {BaseMethod} from 'oag-shared/lang-neutral/base-method';

interface MethodMethodSignature extends MethodSignature {
	readonly $ast: TsmorphMethod;
}

interface MethodMethodDeclaration extends MethodDeclaration {
	readonly $ast: TsmorphMethod;
}

export abstract class TsmorphMethod extends BaseMethod<MethodMethodSignature | MethodMethodDeclaration> {
	protected constructor(baseSettings: BaseSettingsType, protected tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	getType(type: 'intf'): MethodMethodSignature;
	getType(type: 'impl'): MethodMethodDeclaration;
	getType(type: 'hndl'): MethodMethodDeclaration;
	getType(type: string): MethodMethodSignature | MethodMethodDeclaration {
		return this.#tsTypes[type];
	}

	#tsTypes: Record<string, MethodMethodSignature | MethodMethodDeclaration>;
}
