/**
 * @import { Dir } from '../effects/node/virtual/types.ts'
 * @import { Engine } from '../effects/node/types.ts'
 */

import { assert, assertEq, todo } from '../asserts/module.f.js'
import { unwrap } from '../types/result/module.f.js'
import { virtualAt } from '../effects/node/virtual/module.f.mjs'
import { fromEntries } from '../types/object/module.f.js'
import { allFiles, isAuthored, isHostProof, isThirdParty, loadDirectoryModuleMap, loadModuleMap, shouldLoad, shouldLoadOn } from './module.f.mjs'

export const proof = {
    loadDirectoryModuleMap: () => {
        const excluded = () => { assert(false, 'excluded module imported') }
        /** @type {Dir} */
        const root = {
            'z.proof.f.mjs': () => ({ proof: { last: () => undefined } }),
            'module.f.js': () => ({ proof: { inline: () => undefined } }),
            'proof.f.mjs': () => ({ proof: { sibling: () => undefined } }),
            'broken.f.mjs': [],
            '.hidden.f.mjs': excluded,
            'proof.mjs': excluded,
            'old.f.ts': excluded,
            'ordinary.mjs': excluded,
            'child': { 'proof.f.mjs': excluded },
        }
        const [, result] = virtualAt(root)(loadDirectoryModuleMap())
        const map = unwrap(result)
        assertEq(Object.keys(map).join(','), './broken.f.mjs,./module.f.js,./proof.f.mjs,./z.proof.f.mjs')
        const broken = map['./broken.f.mjs']
        assert(broken !== undefined && broken[0] === 'error')
        const loaded = map['./module.f.js']
        assert(loaded !== undefined && loaded[0] === 'ok')
        assert(loaded[1].proof !== undefined)
    },
    loadDirectoryModuleMapEmpty: () => {
        const [, result] = virtualAt({})(loadDirectoryModuleMap())
        assertEq(Object.keys(unwrap(result)).length, 0)
    },
    isThirdParty: () => {
        // Tooling, dependencies and Rust build output.
        assert(isThirdParty('.git'))
        assert(isThirdParty('.github'))
        assert(isThirdParty('node_modules'))
        assert(isThirdParty('target'))
        // This repository's own directories, including ones that merely
        // contain a third-party name.
        assert(!isThirdParty('fjs'))
        assert(!isThirdParty('nanvm-lib'))
        assert(!isThirdParty('targets'))
        assert(!isThirdParty('my.target'))
    },
    allFilesSkipsThirdPartyTrees: () => {
        // Test discovery and `fjs compile` walk the same tree `clean` and the
        // website do: a Rust build tree is not entered, though it holds a file
        // that would otherwise match. A dot-file at any depth is skipped too.
        /** @type {Dir} */
        const root = {
            'target': { 'debug': { 'build.f.mjs': [] } },
            '.cache': { 'c.f.mjs': [] },
            'sub': { 'a.f.mjs': [], '.b.f.mjs': [] },
        }
        const [, result] = virtualAt(root)(allFiles('.', shouldLoad))
        assertEq(unwrap(result).join(','), './sub/a.f.mjs')
    },
    shouldLoad: () => {
        // Every FunctionalScript extension is loaded whatever the file name.
        assert(shouldLoad('foo.f.ts'))
        assert(shouldLoad('foo.f.mts'))
        assert(shouldLoad('bar.f.js'))
        assert(shouldLoad('module.f.mjs'))
        assert(shouldLoad('proof.f.mts'))
        assert(shouldLoad('proof.f.mjs'))
        // Every impure JS/TS extension is loaded only under the `proof` name.
        assert(shouldLoad('proof.ts'))
        assert(shouldLoad('proof.mts'))
        assert(shouldLoad('proof.js'))
        assert(shouldLoad('proof.mjs'))
        assert(!shouldLoad('module.ts'))
        assert(!shouldLoad('module.mts'))
        assert(!shouldLoad('module.js'))
        assert(!shouldLoad('module.mjs'))
        assert(!shouldLoad('readme.md'))
    },
    shouldPass: () => ({
        then: () => undefined
    }),
    ctor: () => {
        const c = (() => { })['constructor']
        const f = c('return 5')
        const result = f()
        assertEq(result, 5, 'function')
    },
    ctorEmpty: () => {
        /** @type {any} */
        const o = {}
        const c = o['constructor']
        // console.log(c)
        // console.log(c(()=>{}))
    },
    ctorUndefined: () => {
        /** @type {any} */
        const o = {
            constructor: undefined
        }
        const c = o['constructor']
        //console.log(c)
    },
    number: () => {
        /** @type {any} */
        const b = '42'
        const r = Number(b)
        //console.log(r)
    },
    properties: () => {
        /** @type {any} */
        const o = {}
        //const c = o['constructor']
        //const c = o['__proto__']
        //const c = o['__defineGetter__']
        //const c = o['__defineSetter__']
        //const c = o['__lookupGetter__']
        //const c = o['__lookupSetter__']
        //const c = o['hasOwnProperty']
        //const c = o['isPrototypeOf']
        //const c = o['propertyIsEnumerable']
        //const c = o['toString']
        const c = o['valueOf']
        //console.log(c)
    },
    getOwnPropertyDescriptor: () => {
        const x = { 'a': 12 }
        const c = Object.getOwnPropertyDescriptor(x, 'constructor')
        const a = Object.getOwnPropertyDescriptor(x, 'a')
    },
    throw: () => {
        todo()
    },
    selectiveDiscovery: () => {
        /** @type {readonly string[]} */
        const files = ['a.f.mjs', 'b.f.js', 'old.f.ts', 'old.f.mts',
            'proof.mjs', 'proof.js', 'proof.ts', 'proof.mts', 'ordinary.mjs']
        for (const select of [isAuthored, isHostProof]) {
            /** @type {Dir} */
            const root = fromEntries(files.map(path => [path, () => {
                assert(select(path), path)
                return {}
            }]))
            const [, result] = virtualAt(root)(loadModuleMap({ env: {}, engine: 'node' }, select))
            const map = unwrap(result)
            assertEq(Object.keys(map).join(','), files.filter(select).map(p => './' + p).toSorted().join(','))
            for (const loaded of Object.values(map)) { assert(loaded !== undefined && loaded[0] === 'ok', loaded) }
        }
        const [, result] = virtualAt({ 'proof.mjs': [] })(loadModuleMap({
            env: {}, engine: 'spidermonkey',
        }, isHostProof))
        assertEq(Object.keys(unwrap(result)).length, 0)
        return undefined
    },
    allFilesFindsFunctionalScript: () => {
        // Every FunctionalScript extension is discovered, so a module migrated
        // from `.f.ts` to `.f.mjs` keeps its proofs. An ordinary `.mjs` is
        // still skipped.
        /** @type {Dir} */
        const root = {
            '.hidden.f.ts': [],
            'a.f.ts': [],
            'b.f.mjs': [],
            'c.f.mts': [],
            'd.mjs': [],
        }
        const [, result] = virtualAt(root)(allFiles('.', shouldLoad))
        assertEq(unwrap(result).join(','), './a.f.ts,./b.f.mjs,./c.f.mts')
        return undefined
    },
    allFilesSkipsNodeModules: () => {
        // `node_modules` is skipped without descending into it, even though
        // it contains a file that would otherwise match the predicate.
        /** @type {Dir} */
        const root = {
            'node_modules': { 'pkg.f.ts': [] },
            'a.f.ts': [],
        }
        const [, result] = virtualAt(root)(allFiles('.', shouldLoad))
        assertEq(unwrap(result).join(','), './a.f.ts')
        return undefined
    },
    loadModuleMapDefaultsToCwdWhenInitCwdUnset: () => {
        // With no `INIT_CWD` (e.g. `fjs t` invoked outside `npm run`), `env`
        // lookup returns `undefined` and discovery falls back to `.`, so
        // every path keeps its own `./`-prefix instead of having one stripped.
        /** @type {Dir} */
        const root = { 'a.f.ts': () => ({}) }
        const [, result] = virtualAt(root)(loadModuleMap({ env: {}, engine: 'node' }))
        assertEq(Object.keys(unwrap(result)).join(','), './a.f.ts')
        return undefined
    },
    loadModuleMapReportsUnreadableRoot: () => {
        // A directory that cannot be listed is no longer a panic. Discovery
        // hands the failure back, and the program that asked for the map is
        // the one that decides what a source tree it cannot read means — for
        // `fjs t` that is a message on `stderr` and exit `1`.
        const [, result] = virtualAt({})(loadModuleMap({ env: { INIT_CWD: 'missing' }, engine: 'node' }))
        assert(result[0] === 'error', result)
        return undefined
    },
    loadModuleMapRecordsUnimportableModule: () => {
        // The half `readdir` does not cover: discovery lists the file, then
        // the import of it fails. `'a.f.ts': []` is content rather than a
        // module, so the virtual runner's `import` refuses it. The map still
        // answers, with that file's entry an `error` and its neighbour loaded:
        // one module that will not load does not hide the others.
        const [, result] = virtualAt({ 'a.f.ts': [], 'b.f.ts': () => ({}) })(loadModuleMap({ env: {}, engine: 'node' }))
        const map = unwrap(result)
        const a = map['./a.f.ts']
        assert(a !== undefined && a[0] === 'error', a)
        const b = map['./b.f.ts']
        assert(b !== undefined && b[0] === 'ok', b)
        return undefined
    },
    loadModuleMapStripsInitCwdPrefix: () => {
        // With `INIT_CWD` set (the normal `npm run` case), discovery starts
        // from that subdirectory and each key is relativized against it, so
        // keys are still `./`-relative to `INIT_CWD` rather than carrying it.
        /** @type {Dir} */
        const root = { 'sub': { 'a.f.ts': () => ({}) } }
        const [, result] = virtualAt(root)(loadModuleMap({ env: { INIT_CWD: 'sub' }, engine: 'node' }))
        assertEq(Object.keys(unwrap(result)).join(','), './a.f.ts')
        return undefined
    },
    shouldLoadOn: () => {
        // The engines running the whole Node host load the impure proofs; any
        // other loads authored modules only.
        for (const engine of /** @type {const} */ (['node', 'deno', 'bun'])) {
            assert(shouldLoadOn(engine)('proof.mjs'), engine)
        }
        assert(!shouldLoadOn('spidermonkey')('proof.mjs'))
        assert(shouldLoadOn('spidermonkey')('a.f.mjs'))
        assert(shouldLoadOn('spidermonkey')('a.f.js'))
        // A retired spelling is FunctionalScript, but not what an engine
        // without TypeScript can load.
        assert(!shouldLoadOn('spidermonkey')('a.f.ts'))
        return undefined
    },
    loadModuleMapLoadsAuthoredOnlyOffTheNodeHost: () => {
        // Off Node, Deno, and Bun the impure proof is never imported, so it
        // cannot fail the run; on Node it is loaded as before.
        /** @type {Dir} */
        const root = { 'a.f.mjs': () => ({}), 'proof.mjs': () => ({}) }
        const keys = (/** @type {Engine} */ engine) =>
            Object.keys(unwrap(virtualAt(root)(loadModuleMap({ env: {}, engine }))[1])).join(',')
        assertEq(keys('spidermonkey'), './a.f.mjs')
        assertEq(keys('node'), './a.f.mjs,./proof.mjs')
        return undefined
    },
}
