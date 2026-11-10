import { assertEq, assertOk } from '../../../../asserts/module.f.js'
import { parseSyntax } from '../../../../compiler/parser/syntax/module.f.mjs'
import { tokenize } from '../../../../compiler/tokenizer/module.f.mjs'
import { stringToList } from '../../../../text/utf16/module.f.js'
import { validate } from './module.f.mjs'

/** @type {(source: string) => import('../../../../compiler/parser/syntax/types.ts').Module} */
const syntax = source => assertOk(parseSyntax(tokenize(stringToList(source))('fixture.f.mjs')))

export const proof = /** @type {const} */ ({
    dynamicImports: () => {
        for (const source of /** @type {const} */ ([
            'export const proof = () => import("./later.f.mjs");',
            'export const proof = () => import.meta.url;',
        ])) {
            const parsed = syntax(source)
            assertEq(parsed.imports.length, 0)
            assertEq(validate(parsed), 'untracked runtime input: import')
        }
        assertEq(validate(syntax('export const proof = () => require("./fixture.json");')),
            'untracked runtime input: require')
    },
    hostReads: () => {
        for (const name of /** @type {const} */ (['process', 'globalThis', 'global', 'Buffer', 'Deno', 'Bun'])) {
            assertEq(validate(syntax(`export const proof = () => ${name}.value;`)),
                `untracked runtime input: ${name}`)
        }
        assertEq(validate(syntax('export const proof = () => process.env.TEST_VALUE;')),
            'untracked runtime input: process')
    },
    clockAndRandomInputs: () => {
        for (const [source, name] of /** @type {const} */ ([
            ['export const proof = () => Date.now();', 'Date'],
            ['export const proof = () => new Date();', 'Date'],
            ['export const proof = () => Date();', 'Date'],
            ['export const proof = () => Math.random();', 'Math.random'],
            ['export const proof = () => Math["random"]();', 'Math.random'],
            ['const random = Math.random; export const proof = () => random();', 'Math.random'],
            ['const random = Math["random"]; export const proof = () => random();', 'Math.random'],
            ['export const proof = () => Math[0];', 'Math.0'],
        ])) {
            assertEq(validate(syntax(source)), `untracked runtime input: ${name}`, source)
        }
    },
    mathNamespaceEscapes: () => {
        for (const source of /** @type {const} */ ([
            'const { random } = Math; export const proof = () => random();',
            'const math = Math; export const proof = () => math.random();',
            'export default { ...Math };',
            'export const proof = key => Math[key]();',
            'export const proof = () => Math["ran" + "dom"]();',
            'export const proof = () => Math?.random();',
            'export const proof = () => Math?.floor(1);',
            'export const proof = () => Math?.["floor"](1);',
        ])) {
            assertEq(validate(syntax(source)), 'untracked runtime input: Math', source)
        }
        for (const member of /** @type {const} */ (['constructor', 'unknown', 'true'])) {
            assertEq(validate(syntax(`export const proof = () => Math.${member};`)),
                `untracked runtime input: Math.${member}`)
            assertEq(validate(syntax(`export const proof = () => Math["${member}"];`)),
                `untracked runtime input: Math.${member}`)
        }
    },
    deterministicMath: () => {
        for (const source of /** @type {const} */ ([
            'export const proof = () => Math.floor(2.5);',
            'export const proof = () => Math.abs(-1);',
            'export const proof = () => Math.min(1, 2);',
            'export const proof = () => Math.max(1, 2);',
            'export const proof = () => Math.PI;',
            'export const proof = () => Math["floor"](2.5);',
            'export const proof = () => Math.floor?.(2.5);',
        ])) {
            assertEq(validate(syntax(source)), null, source)
        }
    },
    dynamicEvaluators: () => {
        for (const [source, name] of /** @type {const} */ ([
            ['export const proof = () => eval("import(\\\"./later.f.mjs\\\")");', 'eval'],
            ['export const proof = () => new Function("return import(\\\"./later.f.mjs\\\")")();', 'Function'],
        ])) {
            const parsed = syntax(source)
            assertEq(parsed.imports.length, 0)
            assertEq(validate(parsed), `untracked runtime input: ${name}`)
        }
    },
    nestedReferences: () => {
        assertEq(validate(syntax('export const proof = () => { const nested = () => globalThis.value; return nested; };')),
            'untracked runtime input: globalThis')
        assertEq(validate(syntax('export const proof = () => [process.env.VALUE, require("./later.json")];')),
            'untracked runtime input: process')
        assertEq(validate(syntax('export const proof = () => Math.floor?.(process.env.VALUE);')),
            'untracked runtime input: process')
        assertEq(validate(syntax('export const proof = () => Math.abs(Date.now());')),
            'untracked runtime input: Date')
        assertEq(validate(syntax('export const proof = () => Math.max(globalThis.value, 0);')),
            'untracked runtime input: globalThis')
    },
    referenceNodesOnly: () => {
        for (const source of /** @type {const} */ ([
            '// process.env.VALUE, import("./later.f.mjs")\nexport default "require globalThis Buffer";',
            'export default { import: 1, require: 2, process: 3, globalThis: 4, module: 5, exports: 6 };',
            'const process = 1; export default 2;',
            'export const proof = process => 1;',
            'const value = 2; export const proof = () => value;',
            'const module = { value: 1 }; export default module.value;',
            'const exports = 2; export const proof = () => exports;',
            'export default ["ref", { token: { kind: "id", value: "process" } }];',
            'export default [null, undefined, true, 0xffffn, `import`];',
            'import { process } from "./utility.f.mjs"; export default 1;',
            '// Date.now(), Math.random()\nexport default "Date Math.random";',
            'export default { Date: 1, Math: 2, random: 3 };',
            'const value = { Math: { floor: 1 } }; export default value.Math.floor;',
            'export const proof = value => value.random();',
            'export const proof = (Math, Date) => 1;',
        ])) {
            assertEq(validate(syntax(source)), null, source)
        }
    },
})
