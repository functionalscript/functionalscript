import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { platform, exit } from 'node:process'
import build, * as Build from './build.f.ts'
const { cpp, cs, rust } = build
import { join } from '../../types/string/module.f.ts'
import { bold, reset } from '../../text/sgr/module.f.ts'
import * as list from '../../types/list/module.f.ts'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename)

const { log, error } = console

const nodeJs = {
    dirname: __dirname,
    platform,
}

const run
: (f: Build.Func) => void
= f => {
    const { file: { name, content }, line } = f(nodeJs)
    log(`${bold}writing: ${name}${reset}`)
    writeFileSync(name, content)
    for (const i of list.iterable(line)) {
        const cmd = join(' ')(i)
        log(`${bold}running: ${cmd}${reset}`)
        try {
            log(execSync(cmd).toString())
        } catch (e: any) {
            error(e.output.toString())
            exit(-1)
        }
    }
}

run(cpp)
run(rust)
run(cs)
