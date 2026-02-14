import { utf8, utf8ToString } from "../../text/module.f.ts"
import { all } from "../../types/effect/module.f.ts"
import { type NodeEffect, type NodeOperations, readFile, writeFile } from "../../types/effect/node/module.f.ts"
import { unwrap } from "../../types/result/module.f.ts"

const { stringify, parse } = JSON

const jsonFile = (jsonFile: string) => `${jsonFile}.json`

const readJson = (name: string) =>
    readFile<NodeOperations>(jsonFile(name))
    .map(v => parse(utf8ToString(unwrap(v))))

const writeVersion = (version: string) => (name: string) =>
    readJson(name)
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

export const updateVersion: NodeEffect<number> =
    readJson('package')
    .pipe(p => {
        const w = writeVersion(p.version)
        return all([w('package'), w('deno')])
    })
    .map(() => 0)
