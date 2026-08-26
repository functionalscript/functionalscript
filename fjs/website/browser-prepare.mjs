/** Generates the browser proof manifest without importing authored modules. */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { run } from '../effects/node/module.mjs'
import { toPosix } from '../path/module.f.mjs'
import { main } from './module.f.mjs'

const sourceRoot = new URL('../', import.meta.url)
const output = new URL('../emergent_testing/_browser-suite.mjs', import.meta.url)

/** @type {(name: string) => boolean} */
const authored = name => name.endsWith('.f.mjs')

/** @type {(directory: URL) => Promise<readonly URL[]>} */
const files = async directory => {
    const entries = await readdir(directory, { withFileTypes: true })
    return (await Promise.all(entries.map(entry => {
        if (entry.name.startsWith('.')) { return [] }
        const url = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory)
        return entry.isDirectory() ? files(url) : authored(entry.name) ? [url] : []
    }))).flat()
}

/** @type {(source: string) => boolean} */
const exportsProof = source =>
    source.includes('export const proof') ||
    source.split('export {').slice(1).some(part => part.split('}')[0].split(',')
        .some(name => (name.split(' as ')[1] ?? name).trim() === 'proof'))

const candidates = await files(sourceRoot)
const selected = (await Promise.all(candidates.map(async url =>
    exportsProof(await readFile(url, 'utf8')) ? [url] : []
))).flat().toSorted((a, b) => a.pathname.localeCompare(b.pathname))

const sourcePath = fileURLToPath(sourceRoot)
const entries = selected.map(url => {
    const path = toPosix(relative(sourcePath, fileURLToPath(url)))
    return `    './fjs/${path}',`
})
const manifest = [
    '/** Generated browser proof source map. Modules are loaded after the page renders. */',
    '',
    '/** @type {readonly string[]} */',
    'export const browserProofSources = [',
    ...entries,
    ']',
    '',
].join('\n')

await writeFile(output, manifest)
await run(main)
