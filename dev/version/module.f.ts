/**
 * Version management helpers for updating project package versions.
 *
 * @module
 */
import { utf8, utf8ToString } from "../../text/module.f.ts"
import { begin, pure, type Effect } from "../../types/effects/module.f.ts"
import { all, readFile, writeFile, type All, type ReadFile, type WriteFile } from "../../types/effects/node/module.f.ts"
import { unwrap } from "../../types/result/module.f.ts"

const { stringify, parse } = JSON

const jsonFile = (jsonFile: string) => `${jsonFile}.json`

const readJson = (name: string) => begin
    .step(() =>readFile(jsonFile(name)))
    .step(v => pure(parse(utf8ToString(unwrap(v)))))

const writeVersion = (version: string) => (name: string) => begin
    .step(() => readJson(name))
    .step(json => writeFile(
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

export const updateVersion: Effect<ReadFile | WriteFile | All, number> = begin
    .step(() => readJson('package'))
    .step(p => {
        const w = writeVersion(p.version)
        return all(w('package'), w('deno'))
    })
    .step(() => pure(0))
