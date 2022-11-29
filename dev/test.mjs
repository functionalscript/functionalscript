import { loadModuleMap } from './module.mjs'

// test runner.
const main = async() => {
    const moduleMap = await loadModuleMap()

    /** @type {(s: string) => <T>(_: T) => T} */
    const log = s => state => {
        console.log(s)
        return state
    }

    /** @type {any} */
    const f = moduleMap['./dev/test/module.f.cjs'].exports
    f({
        moduleMap,
        log,
    })
}

main()