/**
 * The final `prepack` step: drops the declarations generated for authored
 * `private.ts` modules, then proves that nothing left for packaging depends on
 * one.
 *
 * A `private.ts` holds implementation-private types that are outside the public
 * declaration closure (see `fjs/AGENTS.md`), so it stays in the TypeScript
 * program — source consumers are checked — while its `private.d.ts` is never
 * shipped. Declaration emit runs first, this runs last, and the package file
 * list is read after both.
 *
 * The dependency check is semantic, not textual: emitted declarations may keep
 * a source JSDoc `@import { _X } from './private.ts'` comment, which is a
 * comment in a `.d.ts` and no dependency at all. `specifiers` reads static
 * module specifiers as tokens, so it sees the `import`/`export` statements and
 * not what a comment says.
 */

import { readdir, readFile, rm } from 'node:fs/promises'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { local, specifiers } from '../website/browser-source.mjs'

const sourceRoot = new URL('../../', import.meta.url)

/** @type {(url: URL) => string} */
const repoPath = url => relative(fileURLToPath(sourceRoot), fileURLToPath(url))

/** @type {(directory: URL) => Promise<readonly URL[]>} */
const files = async directory => {
    const entries = await readdir(directory, { withFileTypes: true })
    return (await Promise.all(entries.map(entry => {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target') { return [] }
        const url = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory)
        return entry.isDirectory() ? files(url) : [url]
    }))).flat()
}

/** @type {(url: URL, name: string) => boolean} */
const named = (url, name) => url.pathname.endsWith(`/${name}`)

/**
 * Whether a static module specifier names a private type module. Only a
 * repository-relative one can: a bare specifier names a package, and a package
 * has no private module to reach.
 *
 * @type {(specifier: string) => boolean}
 */
const privateSpecifier = specifier => {
    if (!local(specifier)) { return false }
    const name = specifier.slice(specifier.lastIndexOf('/') + 1)
    return name === 'private.ts' || name === 'private.js'
        || name === 'private.mjs' || name === 'private.d.ts'
}

const all = await files(sourceRoot)

// Only a declaration with an authored `private.ts` beside it was generated from
// one; anything else named `private.d.ts` is not this step's to delete.
const authored = new Set(all.filter(url => named(url, 'private.ts')).map(url => url.href))
const generated = all.filter(url =>
    named(url, 'private.d.ts') && authored.has(new URL('private.ts', url).href))

await Promise.all(generated.map(url => rm(url)))
for (const url of generated) {
    console.log(`removed ${repoPath(url)}`)
}

const removed = new Set(generated.map(url => url.href))
const declarations = all.filter(url =>
    (url.pathname.endsWith('.d.ts') || url.pathname.endsWith('.d.mts')) && !removed.has(url.href))

const dependents = (await Promise.all(declarations.map(async url =>
    specifiers(await readFile(url, 'utf8'))
        .filter(privateSpecifier)
        .map(specifier => /** @type {const} */ ([url, specifier]))
))).flat()

for (const [url, specifier] of dependents) {
    console.error(`${repoPath(url)} depends on the unshipped private type module ${specifier}`)
}

if (dependents.length === 0) {
    console.log(`private type modules removed: ${generated.length}; declarations checked: ${declarations.length}`)
} else {
    console.error('move the types a public declaration needs into types.ts, or inline them')
    process.exitCode = 1
}
