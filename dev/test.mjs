import { loadModuleMap } from './module.mjs'

/** @type {(s: string) => <T>(_: T) => T} */
const log = s => state => {
    console.log(s)
    return state
}

/** @type {<T>(_: T) => readonly[number, T]} */
const performanceNow = state => [performance.now(), state]

// test runner.
const main = async() => {
    const moduleMap = await loadModuleMap()

    // await import(self.Deno ? 'https://deno.land/std/node/fs/promises.ts' : 'node:fs/promises')

    /** @type {any} */
    const f = moduleMap['./dev/test/module.f.cjs'].exports
    f({
        moduleMap,
        log,
        performanceNow,
    })
}

main()