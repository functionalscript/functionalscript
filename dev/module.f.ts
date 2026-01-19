import type { Io } from '../io/module.f.ts'
import type { Sign } from '../types/function/compare/module.f.ts'
import { updateVersion } from './version/module.f.ts'
import type { Node } from './version/module.f.ts'
import { decodeUtf8, encodeUtf8 } from '../types/uint8array/module.f.ts'

export const todo = (): never => { throw 'not implemented' }

export type Module = {
    readonly default?: unknown
}

type Entry<T> = readonly[string, T]

const cmp = ([a]: Entry<unknown>, [b]: Entry<unknown>): Sign =>
    a < b ? -1 : a > b ? 1 : 0

export type ModuleMap = {
   readonly[k in string]: Module
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

export const allFiles = (io: Io) => (s: string): Promise<readonly string[]> => {
    const { fs: { promises: { readdir }}, process: { cwd } } = io
    const load = async(p: string): Promise<readonly string[]> => {
        let result: readonly string[] = []
        for (const i of await readdir(p, { withFileTypes: true })) {
            const { name } = i
            if (name.startsWith('.')) { continue }
            const file = `${p}/${name}`
            if (i.isDirectory()) {
                if (name === 'node_modules') { continue}
                result = [...result, ...await load(file)]
                continue
            }
            if (name.endsWith('.js') || name.endsWith('.ts')) {
                result = [...result, file]
            }
        }
        return result
    }
    return load(s)
}

export const loadModuleMap = async (io: Io): Promise<ModuleMap> => {
    const {
        fs: { existsSync },
        asyncImport
    } = io
    let map: ModuleArray = []
    const initCwd = env(io)('INIT_CWD')
    console.log(`INIT_CWD=${initCwd}`)
    const s = initCwd === undefined ? '.' : `${initCwd.replaceAll('\\', '/')}`
    for (const f of await allFiles(io)(s)) {
        if (f.endsWith('.f.js') ||
            (f.endsWith('.f.ts') && !existsSync(f.substring(0, f.length - 3) + '.js'))
        ) {
            const source = await asyncImport(f)
            map = [...map, [f, source]]
        }
    }
    return Object.fromEntries(map.toSorted(cmp))
}

export const index = async (io: Io): Promise<number> => {
    updateVersion(io as Node<void>)
    const jj = './deno.json'
    const jsr_json = JSON.parse(decodeUtf8(await io.fs.promises.readFile(jj)))
    const list = (await allFiles(io)('.')).filter(v => v.endsWith('/module.f.ts') || v.endsWith('/module.ts'))
    //console.log(list)
    const exportsA = list.map(v => [v, `./${v.substring(2)}`])
    // console.log(exportsA)
    const exports = Object.fromEntries(exportsA)
    // console.log(exports)
    const json = JSON.stringify({ ...jsr_json, exports }, null, 2)
    // console.log(json)
    await io.fs.promises.writeFile(jj, encodeUtf8(json))
    return 0
}
