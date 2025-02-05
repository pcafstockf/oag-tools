import assert from 'node:assert';
import {describe, it} from 'node:test';
import {ParamSerializers} from './param-serializers';

describe('StringifyParameter', () => {
	it(`should serialize 'simple' styles`, () => {
		// NOTE: We do not test for encoding==true, as it is assumed that encodeURIComponent is defect free.
		assert.strictEqual(ParamSerializers.s(5, false), '5');
		assert.strictEqual(ParamSerializers.se(5, false), '5');
		assert.strictEqual(ParamSerializers.s([3, 4, 5], false), '3,4,5');
		assert.strictEqual(ParamSerializers.se([3, 4, 5], false), '3,4,5');
		assert.strictEqual(ParamSerializers.s({'role': 'admin', 'firstName': 'Alex'}, false), 'role,admin,firstName,Alex');
		assert.strictEqual(ParamSerializers.se({'role': 'admin', 'firstName': 'Alex'}, false), 'role=admin,firstName=Alex');
	});
	it(`should serialize 'label' styles`, () => {
		assert.strictEqual(ParamSerializers.l(5), '.5');
		assert.strictEqual(ParamSerializers.le(5), '.5');
		assert.strictEqual(ParamSerializers.l([3, 4, 5]), '.3.4.5');
		assert.strictEqual(ParamSerializers.le([3, 4, 5]), '.3.4.5');
		assert.strictEqual(ParamSerializers.l({'role': 'admin', 'firstName': 'Alex'}), encodeURIComponent('.role.admin.firstName.Alex'));
		assert.strictEqual(ParamSerializers.le({'role': 'admin', 'firstName': 'Alex'}), encodeURIComponent('.role=admin.firstName=Alex'));
	});
	it(`should serialize 'matrix' styles`, () => {
		assert.strictEqual(ParamSerializers.m(5), encodeURIComponent(';5'));
		assert.strictEqual(ParamSerializers.me(5), encodeURIComponent(';5'));
		assert.strictEqual(ParamSerializers.m([3, 4, 5]), encodeURIComponent(';3,4,5'));
		assert.strictEqual(ParamSerializers.me([3, 4, 5]), encodeURIComponent(';3;4;5'));
		assert.strictEqual(ParamSerializers.m({'role': 'admin', 'firstName': 'Alex'}), encodeURIComponent(';role,admin,firstName,Alex'));
		assert.strictEqual(ParamSerializers.me({'role': 'admin', 'firstName': 'Alex'}), encodeURIComponent(';role=admin;firstName=Alex'));
	});
	it(`should serialize 'form' styles`, () => {
		const name = 'id';
		assert.strictEqual(ParamSerializers.f(5, name), 'id=5');
		assert.strictEqual(ParamSerializers.fe(5, name), 'id=5');
		assert.strictEqual(ParamSerializers.f([3, 4, 5], name), 'id=' + encodeURIComponent('3,4,5'));
		assert.strictEqual(ParamSerializers.fe([3, 4, 5], name), 'id=3&id=4&id=5');
		assert.strictEqual(ParamSerializers.f({'role': 'admin', 'firstName': 'Alex'}, name), 'id=' + encodeURIComponent('role,admin,firstName,Alex'));
		assert.strictEqual(ParamSerializers.fe({'role': 'admin', 'firstName': 'Alex'}, name), 'id=' + encodeURIComponent('role=admin&firstName=Alex'));
	});
	it(`should serialize 'spaceDelimited' styles`, () => {
		const name = 'id';
		assert.strictEqual(ParamSerializers.sd([3, 4, 5], name), 'id=' + encodeURIComponent('3 4 5'));
	});
	it(`should serialize 'pipeDelimited' styles`, () => {
		const name = 'id';
		assert.strictEqual(ParamSerializers.pd([3, 4, 5], name), 'id=' + encodeURIComponent('3|4|5'));
	});
	it(`should serialize 'deepObject' styles`, () => {
		const name = 'id';
		assert.strictEqual(ParamSerializers.do({'role': 'admin', 'firstName': 'Alex'}, name), 'id[role]=admin&id[firstName]=Alex');
	});
});
