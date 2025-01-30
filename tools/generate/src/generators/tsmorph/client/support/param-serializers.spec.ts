import {ParamSerializers} from './param-serializers';

describe('StringifyParameter', () => {
	const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
	beforeAll(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
	});
	afterAll(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	});
	it(`should serialize 'simple' styles`, () => {
		expect(ParamSerializers.s(5, true)).toEqual('5');
		expect(ParamSerializers.se(5, true)).toEqual('5');
		expect(ParamSerializers.s([3, 4, 5], true)).toEqual('3,4,5');
		expect(ParamSerializers.se([3, 4, 5], true)).toEqual('3,4,5');
		expect(ParamSerializers.s({'role': 'admin', 'firstName': 'Alex'}, false)).toEqual('role,admin,firstName,Alex');
		expect(ParamSerializers.se({'role': 'admin', 'firstName': 'Alex'}, true)).toEqual('role=admin,firstName=Alex');
	});
	it(`should serialize 'label' styles`, () => {
		expect(ParamSerializers.l(5)).toEqual('.5');
		expect(ParamSerializers.le(5)).toEqual('.5');
		expect(ParamSerializers.l([3, 4, 5])).toEqual('.3.4.5');
		expect(ParamSerializers.le([3, 4, 5])).toEqual('.3.4.5');
		expect(ParamSerializers.l({'role': 'admin', 'firstName': 'Alex'})).toEqual('.role.admin.firstName.Alex');
		expect(ParamSerializers.le({'role': 'admin', 'firstName': 'Alex'})).toEqual('.role=admin.firstName=Alex');
	});
	it(`should serialize 'matrix' styles`, () => {
		expect(ParamSerializers.m(5)).toEqual(';5');
		expect(ParamSerializers.me(5)).toEqual(';5');
		expect(ParamSerializers.m([3, 4, 5])).toEqual(';3,4,5');
		expect(ParamSerializers.me([3, 4, 5])).toEqual(';3;4;5');
		expect(ParamSerializers.m({'role': 'admin', 'firstName': 'Alex'})).toEqual(';role,admin,firstName,Alex');
		expect(ParamSerializers.me({'role': 'admin', 'firstName': 'Alex'})).toEqual(';role=admin;firstName=Alex');
	});
	it(`should serialize 'form' styles`, () => {
		const name = 'id';
		expect(ParamSerializers.f(5, name)).toEqual('id=5');
		expect(ParamSerializers.fe(5, name)).toEqual('id=5');
		expect(ParamSerializers.f([3, 4, 5], name)).toEqual('id=3,4,5');
		expect(ParamSerializers.fe([3, 4, 5], name)).toEqual('id=3&id=4&id=5');
		expect(ParamSerializers.f({'role': 'admin', 'firstName': 'Alex'}, name)).toEqual('id=role,admin,firstName,Alex');
		expect(ParamSerializers.fe({'role': 'admin', 'firstName': 'Alex'}, name)).toEqual('role=admin&firstName=Alex');
	});
	it(`should serialize 'spaceDelimited' styles`, () => {
		const name = 'id';
		expect(ParamSerializers.sd([3, 4, 5], name)).toEqual('3 4 5');
	});
	it(`should serialize 'pipeDelimited' styles`, () => {
		const name = 'id';
		expect(ParamSerializers.pd([3, 4, 5], name)).toEqual('3|4|5');
	});
	it(`should serialize 'deepObject' styles`, () => {
		const name = 'id';
		expect(ParamSerializers.do({'role': 'admin', 'firstName': 'Alex'}, name)).toEqual('id[role]=admin&id[firstName]=Alex');
	});
});
