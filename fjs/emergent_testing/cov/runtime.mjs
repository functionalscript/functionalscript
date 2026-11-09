/**
 * Native loader boundary for coverage's runtime and framework inputs. Loading
 * definitions discovers their real transitive files without parsing host JS;
 * the executable entries and proofs are never invoked.
 *
 * @module
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { relative, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url))
/** @type {Set<string>} */
const loaded = new Set()
const hooks = registerHooks({
    load: (url, context, nextLoad) => {
        if (url.startsWith('file:')) loaded.add(fileURLToPath(url))
        return nextLoad(url, context)
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
    import.meta.url,
    new URL('./native/module.mjs', import.meta.url),
    new URL('../one.mjs', import.meta.url),
    new URL('../../module.mjs', import.meta.url),
    new URL('../../module.f.mjs', import.meta.url),
    new URL('../../../package.json', import.meta.url),
]) {
    loaded.add(fileURLToPath(url))
}

const files = Object.fromEntries([...loaded].toSorted().map(path => [
    relative(packageRoot, path).split(sep).join('/'),
    createHash('sha256').update(readFileSync(path)).digest('hex'),
]))

const env = Object.fromEntries(['NODE_OPTIONS', 'NODE_PATH', 'LANG', 'LC_ALL', 'TZ']
    .map(name => [name, process.env[name] ?? null]))

process.stdout.write(JSON.stringify({
    node: process.versions.node,
    versions: process.versions,
    platform: process.platform,
    arch: process.arch,
    env,
    files,
}) + '\n')
