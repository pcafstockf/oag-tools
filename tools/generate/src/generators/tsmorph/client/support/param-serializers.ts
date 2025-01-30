/**
 * In the absence of a dependent library, these keyed functions allows us to quickly serialize parameters (client side) based on OpenAPI style / explode attributes.
 * <p>
 * Assume a param named 'color' has one of the following values:<br/>
 * 	primitive -> true<br/>
 * 	array -> ["blue","black","brown"]<br/>
 * 	object -> { "R": 100, "G": 200, "B": 150 }<br/>
 * </p>
 * Remember that the usage of 'name' as a prefix depends somewhat on 'in' (query vs cookie vs path, etc).
 * Callers of these routines should pass undefined for 'name' if the context does not call for the name prefix
 */
export const ParamSerializers = Object.freeze({
	// matrix (can only be in path and never has a name)
	// ;       ;true          ;blue,black,brown                   ;R,100,G,200,B,150
	m: (value: any) => encodeURIComponent((() => {
		if (Array.isArray(value))
			return `;${value.join(',')}`;
		if (typeof value === 'object' && value)
			return Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? ',' : ''}${v},${value[v]}`;
				return p;
			}, `;`);
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `;`;
		return `;${String(value)}`;
	})()),
	// matrix-explode (can only be in path and never has a name)
	// ;       ;true          ;blue;black;brown                   ;R=100;G=200;B=150
	me: (value: any) => encodeURIComponent((() => {
		if (Array.isArray(value))
			return `;${value.join(`;`)}`;
		if (typeof value === 'object' && value)
			return Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? ';' : ''}${v}=${value[v]}`;
				return p;
			}, ';');
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `;`;
		return `;${String(value)}`;
	})()),
	// label (can only be in path and never has a name)
	// .       .true          .blue.black.brown                   .R.100.G.200.B.150
	l: (value: any) => encodeURIComponent((() => {
		if (Array.isArray(value))
			return `.${value.join('.')}`;
		if (typeof value === 'object' && value)
			return Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? '.' : ''}${v}.${value[v]}`;
				return p;
			}, '.');
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return '.';
		return `.${String(value)}`;
	})()),
	// label-explode (can only be in path and never has a name)
	// .       .true          .blue.black.brown                   .R=100.G=200.B=150
	le: (value: any) => encodeURIComponent((() => {
		if (Array.isArray(value))
			return `.${value.join('.')}`;
		if (typeof value === 'object' && value)
			return Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? '.' : ''}${v}=${value[v]}`;
				return p;
			}, '.');
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return '.';
		return `.${String(value)}`;
	})()),
	// form (can only be in queries and cookies and always has a name)
	// color=  color=true     color=blue,black,brown              color=R,100,G,200,B,150
	f: (value: any, name: string) => {
		if (Array.isArray(value))
			return `${name}=${encodeURIComponent(value.join(','))}`;
		if (typeof value === 'object' && value) {
			return `${name}=` + encodeURIComponent(Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? ',' : ''}${v},${value[v]}`;
				return p;
			}, ''));
		}
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `${name}=`;
		return `${name}=${encodeURIComponent(String(value))}`;
	},
	// form-explode (can only be in queries and cookies and always has a name, but "expands" arrays and "spreads" objects)
	// color=  color=true     color=blue&color=black&color=brown  R=100&G=200&B=150
	fe: (value: any, name: string) => {
		if (Array.isArray(value))
			return `${name}=${value.map(v => encodeURIComponent(v)).join(`&${name}=`)}`;
		if (typeof value === 'object' && value)
			return `${name}=` + encodeURIComponent(Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? '&' : ''}${v}=${value[v]}`;
				return p;
			}, ''));
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `${name}=`;
		return `${name}=${encodeURIComponent(String(value))}`;
	},
	// simple (can only be in path and header). It never has a name AND can never be empty. If in path, you must encode, if in header you need not.
	// n/a     true           blue,black,brown                    R,100,G,200,B,150
	s: (value: any, encode: boolean) => {
		const retVal = (() => {
			if (Array.isArray(value)) {
				if (value.length === 0)
					return undefined;
				return `${value.join(',')}`;
			}
			if (typeof value === 'object' && value)
				return Object.keys(value).reduce((p, v, i) => {
					if (!p)
						p = '';
					p += `${i > 0 ? ',' : ''}${v},${value[v]}`;
					return p;
				}, undefined);
			if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
				return undefined;
			return `${String(value)}`;
		})();
		if (encode)
			return encodeURIComponent(retVal);
		return retVal;
	},
	// simple-explode (can only be in path and header). It never has a name AND can never be empty. If in path, you must encode, if in header you need not.
	// n/a     true           blue,black,brown                    R=100,G=200,B=150
	se: (value: any, encode: boolean) => {
		const retVal = (() => {
			if (Array.isArray(value)) {
				if (value.length == 0)
					return undefined;
				return `${value.join(',')}`;
			}
			if (typeof value === 'object' && value)
				return Object.keys(value).reduce((p, v, i) => {
					if (!p)
						p = '';
					p += `${i > 0 ? ',' : ''}${v}=${value[v]}`;
					return p;
				}, undefined);
			if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
				return undefined;
			return `${String(value)}`;
		})();
		if (encode)
			return encodeURIComponent(retVal);
		return retVal;
	},
	// space-delimited (can only be in query and always has a name) and despite the spec, empty and primitive are reasonable.
	// n/a     n/a            blue%20black%20brown                R%20100%20G%20200%20B%20150
	sd: (value: any, name: string) => {
		if (Array.isArray(value))
			return `${name}=${encodeURIComponent(value.join(' '))}`;
		if (typeof value === 'object' && value)
			return `${name}=` + encodeURIComponent(Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? ' ' : ''}${v} ${value[v]}`;
				return p;
			}, ''));
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `${name}=`;
		return `${name}=${encodeURIComponent(String(value))}`;
	},
	// space-delimited-explode (can only be in query and always has a name) (this is in the 3.0 spec, but not the 3.1) and despite the spec, empty, primitive, and object are reasonable.
	// n/a     n/a            color=blue&color=black&color=brown  n/a
	sde: (value: any, name: string) => {
		if (Array.isArray(value))
			return `${name}=${value.map(v => encodeURIComponent(v)).join(`&${name}=`)}`;
		if (typeof value === 'object' && value)
			return `${name}=` + encodeURIComponent(Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? ' ' : ''}${v} ${value[v]}`;
				return p;
			}, ''));
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `${name}=`;
		return `${name}=${encodeURIComponent(String(value))}`;
	},
	// pipe-delimited (can only be in query and always has a name) and despite the spec, empty and primitive are reasonable.
	// n/a     n/a            blue|black|brown                    R|100|G|200|B|150
	pd: (value: any, name: string) => {
		if (Array.isArray(value))
			return `${name}=${encodeURIComponent(value.join('|'))}`;
		if (typeof value === 'object' && value)
			return `${name}=` + encodeURIComponent(Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? '|' : ''}${v}|${value[v]}`;
				return p;
			}, ''));
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `${name}=`;
		return `${name}=${encodeURIComponent(String(value))}`;
	},
	// pipe-delimited-explode (can only be in query and always has a name) (this is in the 3.0 spec, but not the 3.1) and despite the spec, empty, primitive, and object are reasonable.
	// n/a     n/a            color=blue&color=black&color=brown  n/a
	pde: (value: any, name: string) => {
		if (Array.isArray(value))
			return `${name}=${value.map(v => encodeURIComponent(v)).join(`&${name}=`)}`;
		if (typeof value === 'object' && value)
			return `${name}=` + encodeURIComponent(Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? '|' : ''}${v}|${value[v]}`;
				return p;
			}, ''));
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `${name}=`;
		return `${name}=${encodeURIComponent(String(value))}`;
	},
	// deep-object (can only be in query and always has a name) and despite the spec, empty, primitive, and array are reasonable.
	// n/a     n/a            n/a                                 color[R]=100&color[G]=200&color[B]=150
	do: (value: any, name: string) => {
		if (Array.isArray(value))
			return `${name}=${value.map(v => encodeURIComponent(v)).join(`&${name}=`)}`;
		if (typeof value === 'object' && value)
			return Object.keys(value).reduce((p, v, i) => {
				p += `${i > 0 ? '&' : ''}${name}[${v}]=${encodeURIComponent(value[v])}`;
				return p;
			}, '');
		if (typeof value === 'undefined' || value === null || (typeof value === 'string' && (!value)))
			return `${name}=`;
		return `${name}=${encodeURIComponent(String(value))}`;
	}
});

