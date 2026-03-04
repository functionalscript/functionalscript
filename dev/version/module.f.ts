/**
 * Version management helpers for updating project package versions.
 *
 * @module
 */
import { utf8, utf8ToString } from "../../text/module.f.ts"
import { fluent, pure, step } from "../../types/effects/module.f.ts"
import { all, type NodeEffect, readFile, writeFile } from "../../types/effects/node/module.f.ts"
import { unwrap } from "../../types/result/module.f.ts"

const { stringify, parse } = JSON

const jsonFile = (jsonFile: string) => `${jsonFile}.json`

const readJson = (name: string) => fluent
    .step(() =>readFile(jsonFile(name)))
    .step(v => pure(parse(utf8ToString(unwrap(v)))))
    .effect

const writeVersion = (version: string) => (name: string) =>
    step(readJson(name))(json => writeFile(
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

export const updateVersion: NodeEffect<number> = fluent
    .step(() => readJson('package'))
    .step(p => {
        const w = writeVersion(p.version)
        return all(w('package'), w('deno'))
    })
    .step(() => pure(0))
    .effect
