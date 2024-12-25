import { existsSync } from 'node:fs'
import { readdir, writeFile, readFile } from 'node:fs/promises'
import process from 'node:process'

type Module = {
   readonly default?: unknown
}

type UnknownMap = {
   readonly[k in string]: unknown
}

type Entry<T> = readonly[string, T]

const cmp = ([a]: Entry<unknown>, [b]: Entry<unknown>) =>
    a < b ? -1 : a > b ? 1 : 0

type MutableModuleMap = {
   [k in string]: Module
}

type ModuleMap = {
   readonly[k in string]: Module
}

const remove_tail = (v: readonly string[]) => (dif: number) =>
    v.slice(0, v.length - dif)

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
    const load
        : () => Promise<UnknownMap>
        = async () => {
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

    const build
        : () => ModuleMap
        = () => {
        const d
            : MutableModuleMap
            = {}
        const getModule
            : (base: readonly string[]) => (k: string) => readonly[string, Module]
            = base => k => {
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

/*
const folderMapAdd
    : (m: FolderMap) => (s: readonly string[]) => FolderMap
    = m => s => {
    const [first, ...rest] = s
    const firstResult = m[first]
    return typeof firstResult === 'string'
        ? m
        : {
            ...m,
            [first]: rest.length === 1
                ? rest[0]
                : folderMapAdd(firstResult === undefined ? {} : firstResult)(rest)
        }
}
*/

// const indent = '  '

/*
const codeAdd
    : (i: string) => (p: string) => (m: FolderMap) => readonly[string,string]
    = i => p => m => {
    let result = ''
    let im = ''
    for (const [k, v] of Object.entries(m)) {
        const np = `${p}${k}`
        if (typeof v === 'string') {
            result += `${i}${k}: ${np},\n`
            im += `import ${np} from './${np.replaceAll('$', '/')}/${v}'\n`
        } else {
            const [r, x] = codeAdd(i + indent)(`${np}\$`)(v)
            result += `${i}${k}: \{\n`
            result += r
            result += `${i}\},\n`
            im += x
        }
    }
    return [result, im]
}
*/

export const index = async () => {
    const jj = './deno.json'
    const n = '/module.f.ts'
    const jsr_json = JSON.parse(await readFile(jj, { encoding: 'utf8' }))
    const list = Object.keys(await loadModuleMap()).filter(v => v.endsWith(n))
    const exportsA = list.filter(v => !v.startsWith('./out')).map(v => [v.replace(n, ''), `./${v.substring(2)}`])
    const exports = Object.fromEntries(exportsA)
    await writeFile(
        jj,
        JSON.stringify({ ...jsr_json, exports }, null, 2))
}
