/**
 * Proofs for the static source reading behind the browser proof manifest.
 *
 * A misread here is expensive and silent: a module wrongly selected fails the
 * generated page while it links, before the runner can publish a report, and a
 * module wrongly skipped simply never runs in the browser.
 */

import { assert, assertStructurallySame } from '../asserts/module.f.mjs'
import { codeOnly, exportsProof, local, specifiers } from './browser-source.mjs'

/** @type {(source: string) => void} */
const exports = source => assert(exportsProof(source), source)

/** @type {(source: string) => void} */
const doesNot = source => assert(!exportsProof(source), source)

export const proof = {
    exportsProof: {
        declarations: () => {
            exports('export const proof = {}')
            exports('export let proof = {}')
            exports('export var proof = {}')
            exports('export function proof() {}')
            exports('export class proof {}')
        },
        spacing: () => {
            // Whitespace between the parts is not part of the syntax.
            exports('export\n    const\n    proof = {}')
            exports('export{ proof }')
            exports('export {proof} from \'./x.mjs\'')
        },
        namespace: () => {
            exports('export * as proof from \'./x.mjs\'')
            exports('export *as proof from \'./x.mjs\'')
            doesNot('export * from \'./x.mjs\'')
        },
        namedList: () => {
            // A list entry exports the last name of its `as` chain.
            exports('export { implementation as proof }')
            exports('export { a, b as proof, c }')
            doesNot('export { proof as implementation }')
            doesNot('export { a, b }')
        },
        otherNames: () => {
            // `proof` is a whole name, never a prefix of one.
            doesNot('export const proofs = {}')
            doesNot('export const proofOf = {}')
            doesNot('export { proofs }')
            doesNot('export default proof')
        },
        notCode: () => {
            // The generator itself embeds a module as source text, so a mention
            // inside a comment, a string, or a template is not an export.
            doesNot('// export const proof = {}')
            doesNot('/* export const proof = {} */')
            doesNot('const source = \'export const proof = {}\'')
            doesNot('const source = `export const proof = {}`')
            doesNot('const source = \'export \\\' const proof = {}\'')
        },
        unterminated: () => {
            // Truncated syntax answers `false` rather than running off the end.
            doesNot('export')
            doesNot('export const')
            doesNot('export * as')
            doesNot('export { a as proof')
        },
    },
    codeOnly: {
        keepsLineCount: () => {
            // Specifiers are read per line, so blanking must not move any.
            const source = '/* a\nb */\nimport { x } from \'./y.mjs\'\n'
            assertStructurallySame(
                [codeOnly(source).split('\n').length],
                [source.split('\n').length])
        },
    },
    specifiers: {
        imports: () => {
            assertStructurallySame(
                [...specifiers('import { a } from \'./x.mjs\'\nimport \'node:fs\'\n')],
                ['./x.mjs', 'node:fs'])
        },
        reExports: () => {
            // Both spacings `exportsProof` accepts are walked for dependencies.
            assertStructurallySame(
                [...specifiers('export { proof } from \'./x.mjs\'\nexport{ proof } from \'./y.mjs\'\n')],
                ['./x.mjs', './y.mjs'])
        },
        compactStar: () => {
            // Every spacing the syntax allows, so a module whose dependencies
            // are written compactly is still walked.
            assertStructurallySame(
                [...specifiers('export*as proof from \'node:fs\'\nimport*as dep from \'package\'\n')],
                ['node:fs', 'package'])
        },
        notCode: () => {
            // An embedded code sample is not a dependency: a proof read this
            // way would be dropped from the suite as unlinkable.
            assertStructurallySame(
                [...specifiers('/*\nimport \'node:fs\'\n*/\n')],
                [])
            assertStructurallySame(
                [...specifiers('const sample = `\nimport \'node:fs\'\n`\n')],
                [])
        },
        multiLine: () => {
            assertStructurallySame(
                [...specifiers('import {\n    a,\n} from \'./x.mjs\'\n')],
                ['./x.mjs'])
        },
        prose: () => {
            // A documentation line quoting names is not an import declaration.
            assertStructurallySame(
                [...specifiers(' * tells `\'empty\'` from `\'missing\'`\n')],
                [])
        },
        dynamic: () => {
            // Only what the browser links eagerly counts.
            assertStructurallySame(
                [...specifiers('const m = await import(\'./x.mjs\')\n')],
                [])
        },
    },
    local: () => {
        assert(local('./x.mjs'))
        assert(local('../x.mjs'))
        assert(!local('node:fs'))
        assert(!local('functionalscript/x.mjs'))
    },
}
