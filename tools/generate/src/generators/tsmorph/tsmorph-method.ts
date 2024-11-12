import {BaseMethod, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {MethodDeclaration, MethodSignature} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';

interface MethodMethodSignature extends MethodSignature {
	readonly $ast: TsmorphMethod;
}

interface MethodMethodDeclaration extends MethodDeclaration {
	readonly $ast: TsmorphMethod;
}

export abstract class TsmorphMethod extends BaseMethod {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	getLangNode(type: 'intf'): MethodMethodSignature;
	getLangNode(type: 'impl'): MethodMethodDeclaration;
	getLangNode(type: 'hndl'): MethodMethodDeclaration;
	getLangNode(type: string): MethodMethodSignature | MethodMethodDeclaration {
		return this.#tsTypes[type];
	}

	#tsTypes: Record<string, MethodMethodSignature | MethodMethodDeclaration>;
}
