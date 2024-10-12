/**
 * This plugin walks the document (deeply), to find inline object schema.
 * IF a nested schema has a title or 'x-schema-name', hoist it to global context (#/components/schemas), and modify the parent to reference it.
 * IF a nested schema does *not* have a title or 'x-schema-name', and if
 * the -v (verbose) flag is set, log the JSON Path of the untitled schema.
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import * as fs from 'fs';
import {OpenAPIVisitor} from 'oag-shared/openapi/document-visitor';
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';

// Calculate Jaccard similarity between two sets
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	const intersectionSize = new Set([...a].filter(x => b.has(x))).size;
	const unionSize = new Set([...a, ...b]).size;
	return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// Generate a distance matrix (1 - Jaccard similarity)
function generateDistanceMatrix(wordLists: string[][]): number[][] {
	const n = wordLists.length;
	const sets = wordLists.map(lst => new Set(lst));
	const distanceMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
	for (let i = 0; i < n; i++) {
		for (let j = i; j < n; j++) {
			const similarity = jaccardSimilarity(sets[i], sets[j]);
			const distance = 1 - similarity;
			distanceMatrix[i][j] = distance;
			distanceMatrix[j][i] = distance; // Symmetric matrix
		}
	}
	return distanceMatrix;
}

// Simple agglomerative clustering function
function agglomerativeClustering(distanceMatrix: number[][]): number[] {
	const n = distanceMatrix.length;
	const clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
	// Find closest clusters
	while (clusters.length > 1) {
		let minDistance = Infinity;
		let clusterA = -1, clusterB = -1;
		// Find the pair of clusters with the smallest distance
		for (let i = 0; i < clusters.length; i++) {
			for (let j = i + 1; j < clusters.length; j++) {
				const dist = calculateClusterDistance(clusters[i], clusters[j], distanceMatrix);
				if (dist < minDistance) {
					minDistance = dist;
					clusterA = i;
					clusterB = j;
				}
			}
		}
		// Merge the two closest clusters
		const mergedCluster = clusters[clusterA].concat(clusters[clusterB]);
		clusters.splice(clusterB, 1); // Remove the second cluster
		clusters[clusterA] = mergedCluster; // Replace the first with the merged cluster
	}
	return clusters[0]; // The final cluster gives the ordered indices
}

// Calculate distance between two clusters
function calculateClusterDistance(clusterA: number[], clusterB: number[], distanceMatrix: number[][]): number {
	let totalDistance = 0;
	for (const i of clusterA) {
		for (const j of clusterB)
			totalDistance += distanceMatrix[i][j];
	}
	return totalDistance / (clusterA.length * clusterB.length);
}

interface UpliftSchemaDescriptor {
	name: string;
	jpaths: string[]
}

interface UpliftSchemaPossibility {
	jpath: string;
	signature: string;
	elems: string[];
}

class UpliftSchema extends OpenAPIVisitor {
	constructor(private reportMissing: number) {
		super();
	}
	private refs: SwaggerParser.$Refs;
	private seenObj: Set<any>;
	private upliftPossibilies: Map<string, UpliftSchemaPossibility[]>;

	protected computeUpliftReportEntry(schema: OpenAPIV3.SchemaObject, jsonPath: string) {
		const r = schema.required ?? [];
		const s = Object.keys(schema.properties).sort((a, b) => {
			if (r.includes(a) === r.includes(b))
				return a.localeCompare(b);
			else if (r.includes(a))
				return -1;
			return 1;
		});
		if (schema.additionalProperties)
			s.push('additionals');
		return <UpliftSchemaPossibility>{
			jpath: jsonPath,
			signature: s.join(';'),
			elems: s
		};
	}

	/**
	 * Parse an input configuration into an array of @see UpliftSchemaDescriptor and then apply them to the document.
	 * The format of the input text is a manually modified version of the output from @see reportUpliftPossibilities.
	 * Specifically:
	 *  One or more empty lines signify a record break.
	 *  All lines that do not start with either '@' or whitespace will be ignored.
	 *  A line starting with '@' is considered the desired name of the schema.
	 *  Lines starting with whitespace are trimmed and then treated as a json-pointer to the schema (in the document) to be converted.
	 *  NOTE:
	 *      The first schema is the list will be cloned to a new 'uplifted' schema.
	 *      All schema referred to by the json-pointers will be replaced by a $ref to the cloned schema.
	 *      If a json-pointer line starts with a '*' (after whitespace trimming), it will be moved to the front of the array.
	 *      Meaning it will be the schema that will be cloned and uplifted.
	 *      If the first json-point line starts with a '!', it signals that the uplifted path already exists, and this first element should just be  replaced by a $ref to the top level schema.
	 *  FORMAT:
	 *      @your_schema_name
	 *      a comment (will be ignored)
	 *          !#/components/schemas/foo
	 *      <empty-line>
	 *      other ignored text
	 *      @another_schema_name
	 *          #/components/schemas/baz
	 *          *#/components/schemas/bazbif
	 */
	private async upliftSchemas(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, configTxt: string) {
		let newRecOk = true;
		const config = configTxt.split(/\r?\n/).reduce((p, v, i) => {
			if (v.trim().length === 0) {
				newRecOk = true;
				return p;
			}
			if (/^@\S/.test(v)) {
				v = v.trim().substring(1);
				if (p.find(e => e.name === v)) {
					// We abort all output if the input is invalid.
					console.error('Duplicate schema name: ' + v);
					process.exit(1);
				}
				if (! newRecOk) {
					console.error('Invalid format near line ' + i);
					process.exit(1);
				}
				newRecOk = false;
				p.push({name: v} as UpliftSchemaDescriptor);
			}
			else if (/^\s+\S/.test(v)) {
				const cur = p[p.length-1];
				if (! cur.jpaths)
					cur.jpaths = [];
				v = v.trim();
				if (v.startsWith('*'))
					cur.jpaths.unshift(v.substring(1))
				else
					cur.jpaths.push(v);
			}
			return p;
		}, [] as UpliftSchemaDescriptor[]);
		// We want to replace the most deeply nested schema first so that we don't create invalid refs.
		const jpaths: {jpath: string, name: string, uplift: boolean}[] = [];
		config.forEach(c => {
			c.jpaths.forEach((p, i) => {
				let jp = p;
				if (jp.startsWith('!')) {
					i = -1;
					jp = jp.slice(1);
				}
				jpaths.push({jpath: jp, name: c.name, uplift: i === 0})
			})
		});
		const jpu = new Set<string>();
		jpaths.forEach(e => {
			if (jpu.has(e.jpath)) {
				// We abort all output if the input is invalid.
				console.error('Duplicate paths: ' + e.jpath);
				process.exit(1);
			}
			jpu.add(e.jpath);
		});
		// We want to sort so that we replace more deeply nested schema first and work our way up.
		// But we need to compute path "depth" by segment, not by string length.
		jpaths.sort((a, b) => {
			const as = a.jpath.split(/\//);
			const bs = b.jpath.split(/\//);
			let retVal = bs.length - as.length;
			if (retVal === 0) {
				if (a.uplift !== b.uplift) {
					if (a.uplift)
						retVal = -1;
					else
						retVal = 1;
				}
			}
			return retVal;
		});
		const docParser = new SwaggerParser();
		this.refs = await docParser.resolve(doc);
		jpaths.forEach(jp => {
			this.upliftSchema(jp.jpath, jp.name, jp.uplift);
		});
		delete this.refs;
	}

	/**
	 * This method writes a text file designed to be easily converted (manually) into an input file for @see upliftSchemas.
	 */
	private reportUpliftPossibilities() {
		if (this.upliftPossibilies.size > 0) {
			const wordLists = Array.from(this.upliftPossibilies.values()).map(v => v[0].elems);
			const distanceMatrix = generateDistanceMatrix(wordLists);
			const order = agglomerativeClustering(distanceMatrix);
			const sortedWordLists = order.map(i => wordLists[i]);
			const sortedKeys = sortedWordLists.map(e => e.join(';'));
			sortedKeys.forEach(k => {
				const v = this.upliftPossibilies.get(k);
				console.log(k + ':\n\t' + v.map(e => e.jpath).join('\n\t') + '\n');
			});
			this.upliftPossibilies.clear();
		}
	}

	private upliftSchema(from: string, as: string, hoist: boolean, schema?: OpenAPIV3.SchemaObject) {
		if (! schema)
			schema = this.refs.get(from) as OpenAPIV3.SchemaObject;
		const doc = this.refs.get(`#`) as OpenAPIV3.Document;
		if (!doc.components)
			doc.components = {schemas: {}};
		else if (!doc.components.schemas)
			doc.components.schemas = {};
		const clonedSchema = Object.keys(schema).reduce((p, key) => {
			p[key] = schema[key];
			delete schema[key];
			return p;
		}, {} as OpenAPIV3.SchemaObject);
		const hoistedPath = `#/components/schemas/${as}`;
		(schema as OpenAPIV3.ReferenceObject).$ref = hoistedPath;
		if (hoist) {
			if (doc.components.schemas![as]) {
				console.log(`Collision @ ${from} with existing ${hoistedPath}`)
				return;
			}
			delete clonedSchema['x-schema-name'];
			doc.components.schemas![as] = clonedSchema;
			this.refs.set(hoistedPath, clonedSchema);
			schema = clonedSchema;
		}
		return schema;
	}

	visitSchema(schema: OpenAPIV3.SchemaObject, parent?: OpenAPIV3.SchemaObject): boolean | void {
		let needPop = false;
		const activePath = this.activeJsonPath;
		const isNested = !/^#\/components\/schemas\/([a-z_$][a-z_$0-9]*)$/i.test(activePath);
		const schemaName = schema.title || schema['x-schema-name'];
		if (schemaName) {
			if (isNested) {
				const newSchema = this.upliftSchema(activePath, schemaName, true, schema);
				this.seenObj.add(newSchema);
				this.docPath.push(Object.freeze({
					...schema
				}) as OpenAPIV3.ReferenceObject);
				schema = newSchema;
				needPop = true;
			}
		}
		else if (this.reportMissing && isNested && schema.type === 'object' && schema.properties && Object.keys(schema.properties).length >= this.reportMissing) {
			const h = this.computeUpliftReportEntry(schema, activePath);
			let l = this.upliftPossibilies.get(h.signature);
			if (! l) {
				l = [];
				this.upliftPossibilies.set(h.signature, l);
			}
			const existingPaths = l.map(e => e.jpath);
			if (! existingPaths.includes(h.jpath))
				l.push(h);
		}
		try {
			return super.visitSchema(schema, parent);
		}
		finally {
			if (needPop)
				this.docPath.pop();
		}
	}

	async upliftDocument(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, conf: string): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document | boolean> {
		if (conf)
			await this.upliftSchemas(doc, conf);

		const docParser = new SwaggerParser();
		this.refs = await docParser.resolve(doc);
		this.upliftPossibilies = new Map<string, UpliftSchemaPossibility[]>();
		this.seenObj = new Set();
		this.visit(doc, (ref: OpenAPIV3.ReferenceObject) => {
			const obj = this.refs.get(ref.$ref);
			if (obj) {
				if (this.seenObj.has(obj))
					return;
				this.seenObj.add(obj);
			}
			return obj;
		}, false);
		this.seenObj.clear();

		if (this.reportMissing)
			this.reportUpliftPossibilities();
		return doc;
	}
}

// noinspection JSUnusedGlobalSymbols
export default async function upliftSchema(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, cmdArgs: Record<string, any>): Promise<void> {
	const docVisitor = new UpliftSchema(cmdArgs['uplift-report'] ? Number(cmdArgs['uplift-report']) : 0);
	let upliftConf: string;
	if (cmdArgs['uplift-merge'])
		upliftConf = await fs.promises.readFile(cmdArgs['uplift-merge'], 'utf8');
	await docVisitor.upliftDocument(doc, upliftConf);
	return Promise.resolve();
}
