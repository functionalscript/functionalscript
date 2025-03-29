import type { Io } from '../io/module.f.ts'
import type { Sign } from '../types/function/compare/module.f.ts'
import { updateVersion } from './version/module.f.ts'
import type { Node } from './version/module.f.ts'

export const todo = (): never => { throw 'not implemented' }

export type Module = {
    readonly default?: unknown
}

//export type UnknownMap = {
//    readonly[k in string]: unknown
//}

type Entry<T> = readonly[string, T]

export const cmp = ([a]: Entry<unknown>, [b]: Entry<unknown>): Sign =>
    a < b ? -1 : a > b ? 1 : 0

export type ModuleMap = {
   readonly[k in string]: Module
}

export const remove_tail = (v: readonly string[]) => (dif: number): string[] =>
    v.slice(0, v.length - dif)

export type MutableModuleMap = {
    [k in string]: Module
}

export const env
    : (io: Io) => (v: string) => string|undefined
    = ({ process: { env } }) => a => {
        const r = Object.getOwnPropertyDescriptor(env, a)
        return r === undefined ? undefined :
            typeof r.get === 'function' ? r.get() :
                r.value
    }

type ModuleArray = readonly (readonly[string, Module])[]

export const loadModuleMap = async ({ fs: { promises: { readdir }, existsSync }, asyncImport }: Io): Promise<ModuleMap> => {
    const load = async (): Promise<ModuleMap> => {
        const f
            : (path: string) => Promise<ModuleArray>
            = async p => {
            let map: ModuleArray = []
            for (const i of await readdir(p, { withFileTypes: true })) {
                const { name } = i
                if (!name.startsWith('.')) {
                    const file = `${p}/${name}`
                    if (i.isDirectory()) {
                        map = [...map, ...await f(file)]
                        continue
                    }
                    if (name.endsWith('.f.mjs') ||
                        name.endsWith('.f.js') ||
                        (name.endsWith('.f.ts') && !existsSync(file.substring(0, file.length - 3) + '.js'))
                    ) {
                        const source = await asyncImport(`../${file}`)
                        map = [...map, [file, source]]
                    }
                }
            }
            return map
        }
        return Object.fromEntries((await f('.')).toSorted(cmp))
    }

    return await load()
}

export const index = async (io: Io): Promise<number> => {
    updateVersion(io as Node<void>)
    const jj = './deno.json'
    const n = '/module.f.ts'
    const jsr_json = JSON.parse(await io.fs.promises.readFile(jj, 'utf8'))
    const list = Object.keys(await loadModuleMap(io)).filter(v => v.endsWith(n))
    //console.log(list)
    const exportsA = list.filter(v => !v.startsWith('./out')).map(v => [v.replace(n, ''), `./${v.substring(2)}`])
    // console.log(exportsA)
    const exports = Object.fromEntries(exportsA)
    // console.log(exports)
    const json = JSON.stringify({ ...jsr_json, exports }, null, 2)
    // console.log(json)
    await io.fs.promises.writeFile(jj, json, 'utf8')
    return 0
}
