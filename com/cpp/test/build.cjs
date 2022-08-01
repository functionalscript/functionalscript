const fs = require('node:fs')
const cp = require('node:child_process')
const cpp = require('../test.f.cjs').result

fs.writeFileSync('_result.hpp', cpp)
try {
    console.log(cp.execSync('clang -std=c++11 main.cpp').toString())
} catch (e) {
    // @ts-ignore
    console.error(e.output.toString())
}