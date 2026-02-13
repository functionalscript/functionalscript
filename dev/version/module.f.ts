import { utf8ToString } from "../../text/module.f.ts"
import { type NodeOperations, readFile, type NodeEffect } from "../../types/effect/node/module.f.ts"
import { unwrap } from "../../types/result/module.f.ts"
import { decodeUtf8, encodeUtf8 } from "../../types/uint8array/module.f.ts"

export type Buffer = object

type Fs<T> = {
   readonly readFileSync: (name: string) => Uint8Array
   readonly writeFileSync: (name: string, content: Uint8Array) => T
}

export type Node<T> = {
   readonly fs: Fs<T>
}

const { stringify, parse } = JSON

export const getVersion
    : <T>(fs: Fs<T>) => string
    = fs => readJson(fs)('package').version

const jsonFile = (jsonFile: string) => `${jsonFile}.json`

const readJson: <T>(node: Fs<T>) => (name: string) => any
    = fs => name => parse(decodeUtf8(fs.readFileSync(jsonFile(name))))

export const updateVersion: <T>(node: Node<T>) => readonly[T, T]
    = ({ fs }) => {
        const f = (name: string) => fs.writeFileSync(
            jsonFile(name),
            encodeUtf8(stringify(
                {
                    ...readJson(fs)(name),
                    version: getVersion(fs)
                },
                null,
                2))
        )
        return [
            f('package'),
            f('deno')
        ]
    }

const readJson2 = (name: string): NodeEffect<any> =>
    readFile<NodeOperations>(jsonFile(name))
        .map(d => parse(utf8ToString(unwrap(d))))

// export const updateVersion2: NodeEffect<void> =
