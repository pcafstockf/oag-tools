import {InjectableId} from 'async-injection';

export const ServerSettings = {
	__conf_register: 'CODE_GEN_SERVER',
};

export type ServerSettingsType = Omit<typeof ServerSettings, '__conf_register'>;
export const ServerSettingsToken = Symbol.for(ServerSettings.__conf_register) as InjectableId<ServerSettingsType>;

