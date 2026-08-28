/** Generates the browser proof manifest without importing authored modules. */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { run } from '../effects/node/module.mjs'
import { toPosix } from '../path/module.f.mjs'
import { exportsProof, local, specifiers } from './browser-source.mjs'
import { main } from './module.f.mjs'

const sourceRoot = new URL('../../', import.meta.url)
const output = new URL('../emergent_testing/_browser-suite.mjs', import.meta.url)

/** @type {(name: string) => boolean} */
const authored = name => name.endsWith('.f.mjs')

/** @type {(directory: URL) => Promise<readonly URL[]>} */
const files = async directory => {
    const entries = await readdir(directory, { withFileTypes: true })
    return (await Promise.all(entries.map(entry => {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target') { return [] }
        const url = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory)
        return entry.isDirectory() ? files(url) : authored(entry.name) ? [url] : []
    }))).flat()
}

/**
 * Reads the modules reachable from `frontier` one level at a time, recording
 * for each the bare and `node:` specifiers that would keep a browser from
 * linking it. Traversal is by level and skips what the graph already holds, so
 * an import cycle terminates.
 *
 * A relative specifier naming no file is dropped rather than treated as a
 * blocker: the scan is textual, so a module that emits source of its own — the
 * website generator embeds the page's entry module — offers up import lines
 * that were never its own. A genuinely missing relative import cannot survive
 * anyway, since the proof suite loads every one of these modules in Node.
 *
 * @type {(
 *   frontier: readonly URL[],
 *   graph: ReadonlyMap<string, { readonly blockers: readonly string[], readonly local: readonly URL[] }>,
 * ) => Promise<ReadonlyMap<string, { readonly blockers: readonly string[], readonly local: readonly URL[] }>>}
 */
const readGraph = async (frontier, graph) => {
    const next = frontier.filter(url => !graph.has(url.href))
    if (next.length === 0) { return graph }
    const read = await Promise.all(next.map(async url => {
        const found = await readFile(url, 'utf8').then(specifiers, () => [])
        return /** @type {const} */ ([url.href, {
            blockers: found.filter(specifier => !local(specifier)),
            local: found.filter(local).map(specifier => new URL(specifier, url)),
        }])
    }))
    return readGraph(
        read.flatMap(([, module]) => [...module.local]),
        new Map([...graph, ...read]))
}

/**
 * The blockers reachable from `root`, deduplicated. Empty means the whole
 * dependency graph is plain relative ES modules, which a browser can link.
 *
 * @type {(graph: Awaited<ReturnType<typeof readGraph>>, root: URL) => readonly string[]}
 */
const blockersOf = (graph, root) => {
    /** @type {(frontier: readonly string[], visited: ReadonlySet<string>) => ReadonlySet<string>} */
    const reach = (frontier, visited) => {
        const next = frontier.filter(href => !visited.has(href))
        if (next.length === 0) { return visited }
        return reach(
            next.flatMap(href => (graph.get(href)?.local ?? []).map(url => url.href)),
            new Set([...visited, ...next]))
    }
    return [...new Set([...reach([root.href], new Set())].flatMap(href =>
        [...graph.get(href)?.blockers ?? []]))]
}

/** @type {(url: URL) => string} */
const sitePath = url => toPosix(relative(fileURLToPath(sourceRoot), fileURLToPath(url)))

const candidates = await files(sourceRoot)
const withProof = (await Promise.all(candidates.map(async url =>
    exportsProof(await readFile(url, 'utf8')) ? [url] : []
))).flat().toSorted((a, b) => a.pathname.localeCompare(b.pathname))

// A proof module is valid FunctionalScript whether or not it can be linked in
// a browser: external packages and repository-owned `.mjs` are both allowed at
// runtime, and either may reach `node:` further down. Emitting an import for
// such a module would fail the page while linking the suite — before the
// runner can publish a report — so unsupported graphs are dropped here, with
// the reason printed, rather than breaking the page.
const graph = await readGraph(withProof, new Map())
const classified = withProof.map(url =>
    /** @type {const} */ ([url, blockersOf(graph, url)]))
const selected = classified.flatMap(([url, blockers]) => blockers.length === 0 ? [url] : [])

for (const [url, blockers] of classified) {
    if (blockers.length !== 0) {
        console.log(`skipped ${sitePath(url)}: not linkable in a browser (${blockers.join(', ')})`)
    }
}
console.log(`browser proof modules: ${selected.length} of ${classified.length}`)

const manifest = [
    '/** Generated browser proof source map. Modules are loaded after the page renders. */',
    '',
    '/** @type {readonly string[]} */',
    'export const browserProofSources = [',
    ...selected.map(url => `    './${sitePath(url)}',`),
    ']',
    '',
].join('\n')

await writeFile(output, manifest)
await run(main)
