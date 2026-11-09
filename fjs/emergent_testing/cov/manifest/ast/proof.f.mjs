import { assertEq, assertOk } from '../../../../asserts/module.f.js'
import { parseSyntax } from '../../../../compiler/parser/syntax/module.f.mjs'
import { tokenize } from '../../../../compiler/tokenizer/module.f.mjs'
import { stringToList } from '../../../../text/utf16/module.f.js'
import { validate } from './module.f.mjs'

/** @type {(source: string) => import('../../../../compiler/parser/syntax/types.ts').Module} */
const syntax = source => assertOk(parseSyntax(tokenize(stringToList(source))('fixture.f.mjs')))

export const proof = {
    dynamicImports: () => {
        for (const source of [
            'export const proof = () => import("./later.f.mjs");',
            'export const proof = () => import.meta.url;',
        ]) {
            const parsed = syntax(source)
            assertEq(parsed.imports.length, 0)
            assertEq(validate(parsed), 'untracked runtime input: import')
        }
        assertEq(validate(syntax('export const proof = () => require("./fixture.json");')),
            'untracked runtime input: require')
    },
    hostReads: () => {
        for (const name of ['process', 'globalThis', 'global', 'Buffer', 'Deno', 'Bun']) {
            assertEq(validate(syntax(`export const proof = () => ${name}.value;`)),
                `untracked runtime input: ${name}`)
        }
        assertEq(validate(syntax('export const proof = () => process.env.TEST_VALUE;')),
            'untracked runtime input: process')
    },
    dynamicEvaluators: () => {
        for (const [source, name] of [
            ['export const proof = () => eval("import(\\\"./later.f.mjs\\\")");', 'eval'],
            ['export const proof = () => new Function("return import(\\\"./later.f.mjs\\\")")();', 'Function'],
        ]) {
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
    },
    referenceNodesOnly: () => {
        for (const source of [
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
        ]) {
            assertEq(validate(syntax(source)), null, source)
        }
    },
}
