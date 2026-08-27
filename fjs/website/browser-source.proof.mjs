/**
 * Proofs for the static source reading behind the browser proof manifest.
 *
 * A misread here is expensive and silent: a module wrongly selected fails the
 * generated page while it links, before the runner can publish a report, and a
 * module wrongly skipped simply never runs in the browser.
 */

import { assert, assertStructurallySame } from '../asserts/module.f.mjs'
import { exportsProof, local, specifiers } from './browser-source.mjs'

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
        modifiers: () => {
            // Both are zero-argument named exports the ordinary runner accepts,
            // so the manifest has to see them too.
            exports('export async function proof() {}')
            exports('export function* proof() {}')
            exports('export async function* proof() {}')
            doesNot('export async function proofs() {}')
            doesNot('export function* proofs() {}')
        },
        spacing: () => {
            // Whitespace between the parts is not part of the syntax.
            exports('export\n    const\n    proof = {}')
            exports('export{ proof }')
            exports('export {proof} from \'./x.mjs\'')
        },
        patterns: () => {
            // A declaration can bind through a pattern, and the repository
            // already exports through one: `export const { merge, get } = map`.
            exports('export const { proof } = value')
            exports('export const { value: proof } = source')
            exports('export const { a, proof } = source')
            exports('export const [proof] = source')
            doesNot('export const { proof: alias } = source')
            doesNot('export const { other } = source')
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
            // Line boundaries are not part of the syntax, wherever they fall.
            assertStructurallySame(
                [...specifiers('import {\n    a,\n} from \'./x.mjs\'\n')],
                ['./x.mjs'])
            assertStructurallySame(
                [...specifiers('import\n\'node:fs\'\n')],
                ['node:fs'])
            assertStructurallySame(
                [...specifiers('export { a }\nfrom\n\'package\'\n')],
                ['package'])
        },
        inText: () => {
            // A `from` inside prose or a string literal is not a declaration.
            assertStructurallySame(
                [...specifiers('const s = "tells \'empty\' from \'missing\'"\n')],
                [])
            assertStructurallySame(
                [...specifiers('// import \'node:fs\'\n')],
                [])
            // Including when the prose trails a declaration that is real: a
            // module blocked by its own comment would be dropped in silence.
            assertStructurallySame(
                [...specifiers('import \'./ok.mjs\' // import \'node:fs\'\n')],
                ['./ok.mjs'])
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
