/**
 * Native loader boundary for coverage's runtime and framework inputs. Loading
 * definitions discovers their real transitive files without parsing host JS;
 * the executable entries and proofs are never invoked.
 *
 * @module
 */

import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { isBuiltin, registerHooks } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url))
/** @type {Map<string, string>} */
const fingerprints = new Map()
/** @type {Map<string, { readonly name: string, readonly id: string, readonly path: string }>} */
const resolutions = new Map()
/** @type {Map<string, boolean>} */
const packageScopes = new Map()

/** @type {(value: string | URL) => URL} */
const _fileURL = value => {
    const url = new URL(value)
    if (url.protocol !== 'file:' || url.search !== '' || url.hash !== '') {
        throw new Error(`unsupported coverage runtime URL: ${url.href}`)
    }
    return url
}

/** @type {(path: string, source: string | ArrayBuffer | NodeJS.TypedArray) => void} */
const _record = (path, source) => {
    const fingerprint = createHash('sha256').update(source instanceof ArrayBuffer ? new Uint8Array(source) : source).digest('hex')
    const before = fingerprints.get(path)
    if (before !== undefined && before !== fingerprint) {
        throw new Error(`coverage runtime input changed while loading: ${path}`)
    }
    fingerprints.set(path, fingerprint)
}

/** Capture existing and absent package scopes before Node can interpret a file.
 * @type {(path: string) => void}
 */
const _scopes = path => {
    let directory = dirname(path)
    for (;;) {
        const name = join(directory, 'package.json')
        if (!packageScopes.has(name)) {
            try {
                const path = realpathSync(name)
                _resolution(name, pathToFileURL(path).href, path)
                if (!fingerprints.has(path)) _record(path, readFileSync(path))
                packageScopes.set(name, true)
            } catch (problem) {
                if (!(problem instanceof Error) || !('code' in problem) || problem.code !== 'ENOENT') throw problem
                packageScopes.set(name, false)
            }
        }
        if (packageScopes.get(name)) return
        const parent = dirname(directory)
        if (parent === directory) return
        directory = parent
    }
}

/** @type {(name: string, id: string, path: string) => void} */
const _resolution = (name, id, path) => {
    resolutions.set(JSON.stringify([name, id, path]), { name, id, path })
}

/** Inventory an entry without executing it; loaded inputs keep their actual source.
 * @type {(url: string | URL) => void}
 */
const _entry = url => {
    const name = fileURLToPath(_fileURL(url))
    const path = realpathSync(name)
    _scopes(path)
    _resolution(name, pathToFileURL(path).href, path)
    if (!fingerprints.has(path)) _record(path, readFileSync(path))
}

const invoked = resolve(process.argv[1])
if (realpathSync(invoked) !== fileURLToPath(import.meta.url)) {
    throw new Error('coverage runtime probe must be its process entry')
}
_entry(pathToFileURL(invoked))

const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) => {
        if (isBuiltin(specifier)) {
            const resolved = nextResolve(specifier, context)
            if (!resolved.url.startsWith('node:')) throw new Error(`unsupported coverage runtime resolution: ${specifier}`)
            return resolved
        }
        if (!specifier.startsWith('file:') && !specifier.startsWith('./') && !specifier.startsWith('../') && !isAbsolute(specifier)) {
            throw new Error(`unsupported coverage runtime import: ${specifier}`)
        }
        const requested = _fileURL(new URL(specifier, context.parentURL))
        const name = fileURLToPath(requested)
        const path = realpathSync(name)
        _scopes(path)
        const resolved = nextResolve(specifier, context)
        const canonical = _fileURL(resolved.url)
        if (canonical.href !== pathToFileURL(path).href) {
            throw new Error(`coverage runtime resolution changed while loading: ${name}`)
        }
        _resolution(name, canonical.href, path)
        return resolved
    },
    load: (url, context, nextLoad) => {
        const loaded = nextLoad(url, context)
        if (!url.startsWith('node:')) {
            const path = fileURLToPath(_fileURL(url))
            if (loaded.source === null || loaded.source === undefined) {
                throw new Error(`coverage runtime source unavailable: ${path}`)
            }
            _record(path, loaded.source)
        }
        return loaded
    },
})

try {
    await import('../../effects/node/module.mjs')
    await import('./reporter.mjs')
    await import('../module.f.mjs')
    await import('../../cli/module.f.mjs')
} finally {
    hooks.deregister()
}

for (const url of [
    new URL('../one.mjs', import.meta.url),
    new URL('../../module.mjs', import.meta.url),
    new URL('../../module.f.mjs', import.meta.url),
    new URL('../../../package.json', import.meta.url),
]) {
    _entry(url)
}

const inputs = [...fingerprints].map(([path, fingerprint]) =>
    [relative(packageRoot, path).split(sep).join('/'), fingerprint]).toSorted(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
const files = inputs.map(([path]) => path)

const env = Object.fromEntries(['NODE_OPTIONS', 'NODE_PATH', 'LANG', 'LC_ALL', 'TZ']
    .map(name => [name, process.env[name] ?? null]))

process.stdout.write(JSON.stringify({
    node: process.versions.node,
    versions: process.versions,
    platform: process.platform,
    arch: process.arch,
    env,
    files,
    fingerprints: Object.fromEntries(inputs),
    resolutions: [...resolutions].toSorted(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, resolution]) => resolution),
    absentScopes: [...packageScopes].filter(([, present]) => !present).map(([path]) => path).toSorted(),
}) + '\n')
