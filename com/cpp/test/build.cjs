const fs = require('node:fs')
const cp = require('node:child_process')
const os = require('node:os');
const cpp = require('../testlib.f.cjs').result
const { string: { join }, list: { flat } } = require('../../../types/module.f.cjs')

fs.writeFileSync('_result.hpp', cpp)
try {
    const flags = os.platform() === 'win32' ? [] : ['-std=c++11', '-lc++']
    const line = join(' ')(flat([['clang'], flags, ['main.cpp']]))
    console.log(cp.execSync(line).toString())
} catch (e) {
    // @ts-ignore
    console.error(e.output.toString())
}