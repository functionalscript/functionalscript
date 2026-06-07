/**
 * Version management helpers for updating project package versions.
 *
 * @module
 */
import { utf8, utf8ToString } from '../../text/module.f.ts'
import { begin, pure, type Effect } from '../../effects/module.f.ts'
import { all, readFile, writeFile, type All, type ReadFile, type WriteFile } from '../../effects/node/module.f.ts'
import { unwrap } from '../../types/result/module.f.ts'
import { validatePackageJson, type PackageJson } from '../../package_json/module.f.ts'
import { assert } from '../../asserts/module.f.ts'

const { parse, stringify } = JSON

const jsonFile = (jsonFile: string) => `${jsonFile}.json`

const readJson = (name: string) => begin
    .step(() =>readFile(jsonFile(name)))
    .step(v => pure(unwrap(validatePackageJson(parse(utf8ToString(unwrap(v)))))))

const writeVersion = (version: string) => (name: string) => begin
    .step(() => readJson(name))
    .step((json: PackageJson) => writeFile(
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

const version = (p: PackageJson): string => {
    assert(p.version !== undefined, 'package.json version is missing')
    return p.version
}

export const updateVersion: Effect<ReadFile | WriteFile | All, number> = begin
    .step(() => readJson('package'))
    .step(p => {
        const w = writeVersion(version(p))
        return all(w('package'), w('deno'))
    })
    .step(() => pure(0))
