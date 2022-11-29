const list = require('../../types/list/module.f.cjs')
const { flat } = list

const cppContent = require('../cpp/testlib.f.cjs')
const csContent = require('../cs/testlib.f.cjs')
const rustContent = require("../rust/testlib.f.cjs")

/**
 * @typedef {|
 *  'aix' |
 *  'android' |
 *  'darwin' |
 *  'freebsd' |
 *  'haiku' |
 *  'linux' |
 *  'openbsd' |
 *  'sunos' |
 *  'win32' |
 *  'cygwin' |
 *  'netbsd'
 * } Platform
 */

/**
 * @typedef {{
 *  readonly dirname: string
 *  readonly platform: Platform
 * }} NodeJs
 */

/**
 * @typedef {{
 *  readonly file: {
 *      readonly name: string
 *      readonly content: string
 *  }
 *  readonly line: list.List<list.List<string>>
 * }} Output
 */

/** @typedef {(nodejs: NodeJs) => Output} Func */

/** @type {(platform: Platform) => readonly string[]} */
const flags = platform => {
    switch (platform) {
        case 'win32':
            return []
        case 'linux':
            return ['-std=c++17', '-lstdc++', '-fPIC']
        default:
            return ['-std=c++17', '-lc++']
    }
}

/** @type {(platform: Platform) => (name: string) => string} */
const output = platform => name => {
    switch (platform) {
        case 'win32': return `${name}.dll`
        case 'darwin': return `lib${name}.dylib`
        default: return `lib${name}.so`
    }
}

/** @type {Func} */
const cpp = ({dirname, platform}) => ({
    file: {
        name: `${dirname}/cpp/_result.hpp`,
        content: cppContent(),
    },
    line: [
        flat([
            ['clang', '-shared', '-o', output(platform)('testc')],
            flags(platform),
            [`${dirname}/cpp/main.cpp`],
        ]),
    ],
})

/** @type {Func} */
const cs = ({dirname, platform}) => ({
    file: {
        name: `${dirname}/cs/_result.cs`,
        content: csContent,
    },
    line: [
        platform === 'win32'
            ? ['dotnet', 'run', '--project', `${dirname}/cs/cs.csproj`]
        // .Net on Linux and MacOS doesn't properly support COM object marshalling
            : ['dotnet', 'build', `${dirname}/cs/cs.csproj`]
    ],
})

/** @type {Func} */
const rust = ({dirname}) => ({
    file: {
        name: `${dirname}/rust/src/_result.rs`,
        content: rustContent,
    },
    line: [['cargo', 'build']]
})

module.exports = {
    /** @readonly */
    cpp,
    /** @readonly */
    cs,
    /** @readonly */
    rust,
}
