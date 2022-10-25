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
            return ['-lstdc++']
        default:
            return ['-std=c++11', '-lc++']
    }
}

/** @type {Func} */
const cpp = ({dirname, platform}) => {
    const extension = platform === 'win32' ? 'dll' : 'so'
    return {
        file: {
            name: `${dirname}/cpp/_result.hpp`,
            content: cppContent,
        },
        line: [
            flat([
                ['clang', '-shared', '-o', `main.${extension}`],
                flags(platform),
                [`${dirname}/cpp/main.cpp`]]
            ),
            // ['clang', '-shared', 'main.o'],
        ],
    }
}

/** @type {Func} */
const cs = ({dirname}) => ({
    file: {
        name: `${dirname}/cs/_result.cs`,
        content: csContent,
    },
    line: [['dotnet', 'build', `${dirname}/cs/cs.csproj`]],
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