import { existsSync } from 'node:fs'
import { readdir, writeFile, readFile } from 'node:fs/promises'
import process from 'node:process'
import { cmp, remove_tail, type Module, type ModuleMap, type UnknownMap } from './module.f.ts'

export type MutableModuleMap = {
    [k in string]: Module
}

export const exit
    : (code: number) => never
    = process.exit

export const env
    : (v: string) => string|undefined
    = a => {
        const r = Object.getOwnPropertyDescriptor(process.env, a)
        return r === undefined ? undefined :
            typeof r.get === 'function' ? r.get() :
                r.value
    }

export const loadModuleMap = async () => {
    const load = async (): Promise<UnknownMap> => {
        const map
            : (readonly[string, unknown])[]
            = []
        const f
            : (path: string) => Promise<void>
            = async p => {
            for (const i of await readdir(p, { withFileTypes: true })) {
                const { name } = i
                if (!name.startsWith('.')) {
                    const file = `${p}/${name}`
                    if (i.isDirectory()) {
                        await f(file)
                        continue
                    }
                    if (name.endsWith('.f.mjs') ||
                        name.endsWith('.f.js') ||
                        (name.endsWith('.f.ts') && !existsSync(file.substring(0, file.length - 3) + '.js'))
                    ) {
                        const source = await import(`../${file}`)
                        map.push([file, source.default])
                    }
                }
            }
        }
        await f('.')
        map.sort(cmp)
        return Object.fromEntries(map)
    }

    const map = await load()

    const build = (): ModuleMap => {
        const d: MutableModuleMap = {}
        const getModule = (base: readonly string[]) => (k: string): readonly[string, Module] => {
            const relativePath = k.split('/')
            const dif = relativePath.filter(v => v === '..').length
            const path = [remove_tail(base)(dif), relativePath.filter(v => !['..', '.'].includes(v))]
                .flat()
            const pathStr = path.join('/')
            {
                const module = d[pathStr]
                if (module !== void 0) {
                    return [pathStr, module]
                }
            }
            {
                const module = { default: map[pathStr] }
                d[pathStr] = module
                return [pathStr, module]
            }
        }
        {
            const get = getModule(['.'])
            for (const k of Object.keys(map)) {
                get(k)
            }
        }
        return d
    }

    return build()
}

type FolderMap = {
   readonly[k in string]: string | FolderMap
}

export const index = async () => {
    const jj = './deno.json'
    const n = '/module.f.ts'
    const jsr_json = JSON.parse(await readFile(jj, { encoding: 'utf8' }))
    const list = Object.keys(await loadModuleMap()).filter(v => v.endsWith(n))
    //console.log(list)
    const exportsA = list.filter(v => !v.startsWith('./out')).map(v => [v.replace(n, ''), `./${v.substring(2)}`])
    // console.log(exportsA)
    const exports = Object.fromEntries(exportsA)
    // console.log(exports)
    const json = JSON.stringify({ ...jsr_json, exports }, null, 2)
    // console.log(json)
    await writeFile(jj, json)
}
