import { writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { platform, exit } from 'node:process'
import build from './build.f.cjs'
const { cpp, cs, rust } = build
import { join } from '../../types/string/module.f.cjs'
const { log, error } = console
import sgr from '../../text/sgr/module.f.cjs'
const { bold, reset } = sgr
import list from '../../types/list/module.f.cjs'

const nodeJs = {
    dirname: __dirname,
    platform,
}

/** @type {(f: build.Func) => void} */
const run = f => {
    const { file: { name, content }, line } = f(nodeJs)
    log(`${bold}writing: ${name}${reset}`)
    writeFileSync(name, content)
    for (const i of list.iterable(line)) {
        const cmd = join(' ')(i)
        log(`${bold}running: ${cmd}${reset}`)
        try {
            log(execSync(cmd).toString())
        } catch (e) {
            // @ts-ignore
            error(e.output.toString())
            exit(-1)
        }
    }
}

run(cpp)
run(rust)
run(cs)
