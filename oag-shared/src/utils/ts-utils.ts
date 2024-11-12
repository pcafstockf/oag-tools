/**
 * The is the Alternative or Legacy pattern for mixin classes in TypeScript.
 * https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
 */
function applyMixins(derivedCtor: any, constructors: any[]) {
	constructors.forEach((baseCtor) => {
		Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
			Object.defineProperty(
				derivedCtor.prototype,
				name,
				Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
				Object.create(null)
			);
		});
	});
}

/**
 * Much like applyMixins, except you mix a class into an existing object at runtime.
 * @see applyMixins
 * WARNING:
 *  Same rules apply.  You can cause name collisions!
 */
export function dynamicMixin<T>(obj: T, ...mixins: any[]): T {
	mixins.forEach(mixin => {
		Object.getOwnPropertyNames(mixin.prototype).forEach(name => {
			(obj as any)[name] = mixin.prototype[name];
		});
	});
	return obj;
}
