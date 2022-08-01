const fs = require('node:fs')
const cp = require('node:child_process')
const cpp = require('../test.f.cjs').result
const os = require('node:os');

fs.writeFileSync('_result.hpp', cpp)
try {
    const flags = os.platform() === 'win32' ? '' : ' -std=c++11 -lc++'
    console.log(cp.execSync(`clang${flags} main.cpp`).toString())
} catch (e) {
    // @ts-ignore
    console.error(e.output.toString())
}