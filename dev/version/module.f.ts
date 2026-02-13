import { utf8, utf8ToString } from "../../text/module.f.ts"
import { all } from "../../types/effect/module.f.ts"
import { type NodeOperations, readFile, writeFile } from "../../types/effect/node/module.f.ts"
import { unwrap } from "../../types/result/module.f.ts"
import { decodeUtf8, encodeUtf8 } from "../../types/uint8array/module.f.ts"

// type Buffer = object

type Fs<T> = {
   readonly readFileSync: (name: string) => Uint8Array
   readonly writeFileSync: (name: string, content: Uint8Array) => T
}

export type Node<T> = {
   readonly fs: Fs<T>
}

const { stringify, parse } = JSON

const getVersion
    : <T>(fs: Fs<T>) => string
    = fs => readJson(fs)('package').version

const jsonFile = (jsonFile: string) => `${jsonFile}.json`

const readJson: <T>(node: Fs<T>) => (name: string) => any
    = fs => name => parse(decodeUtf8(fs.readFileSync(jsonFile(name))))

export const updateVersion: <T>(node: Node<T>) => readonly T[]
    = ({ fs }) => {
        const f = (name: string) =>
            fs.writeFileSync(
                jsonFile(name),
                encodeUtf8(stringify(
                    {
                        ...readJson(fs)(name),
                        version: getVersion(fs)
                    },
                    null,
                    2)))
        return [
            f('package'),
            f('deno')
        ]
    }

const readJson2 = (name: string) =>
    readFile<NodeOperations>(jsonFile(name))
    .map(v => parse(utf8ToString(unwrap(v))))

const writeVersion = (version: string) => (name: string) =>
    readJson2(name)
    .pipe(json => writeFile(
        jsonFile(name),
        utf8(stringify(
            {
                ...json,
                version,
            },
            null,
            2
        ))
    ))

export const updateVersion2 =
    readJson2('package')
    .pipe(p => {
        const w = writeVersion(p.version)
        return all([w('package'), w('deno')])
    })
    .map(() => 0)
