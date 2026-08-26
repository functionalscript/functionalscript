/** Generates the browser proof manifest without importing authored modules. */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { relative } from 'node:path'

const sourceRoot = new URL('../', import.meta.url)
const output = new URL('../emergent_testing/browser-suite.mjs', import.meta.url)

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
        .some(name => name.trim().split(' ')[0] === 'proof'))

const candidates = await files(sourceRoot)
const selected = (await Promise.all(candidates.map(async url =>
    exportsProof(await readFile(url, 'utf8')) ? [url] : []
))).flat().toSorted((a, b) => a.pathname.localeCompare(b.pathname))

const imports = selected.map((url, index) =>
    `import { proof as proof${index} } from '../../fjs/${relative(sourceRoot.pathname, url.pathname)}'`
)
const entries = selected.map((url, index) =>
    `    ['./fjs/${relative(sourceRoot.pathname, url.pathname)}', proof${index}],`
)
const manifest = [
    '/** Generated browser proof manifest. Every entry is loaded as a native ES module. */',
    '',
    ...imports,
    '',
    '/** @type {readonly (readonly [string, unknown])[]} */',
    'export const browserProofModules = [',
    ...entries,
    ']',
    '',
].join('\n')

await writeFile(output, manifest)
