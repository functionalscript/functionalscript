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
 *  readonly line: list.List<string>
 * }} Output
 */

/** @typedef {(nodejs: NodeJs) => Output} Func */

const flags = [
    '-std=c++11', // for MacOS
    '-lc++', // for MacOS
    '-lstdc++', // for Linux
]

/** @type {Func} */
const cpp = ({dirname}) => ({
    file: {
        name: `${dirname}/cpp/_result.hpp`,
        content: cppContent,
    },
    line: flat([
        ['clang'],
        flags,
        [`${dirname}/cpp/main.cpp`]]
    ),
})

/** @type {Func} */
const cs = ({dirname}) => ({
    file: {
        name: `${dirname}/cs/_result.cs`,
        content: csContent,
    },
    line: ['dotnet', 'build', `${dirname}/cs/cs.csproj`],
})

/** @type {Func} */
const rust = ({dirname}) => ({
    file: {
        name: `${dirname}/rust/src/_result.rs`,
        content: rustContent,
    },
    line: ['cargo', 'build']
})

module.exports = {
    /** @readonly */
    cpp,
    /** @readonly */
    cs,
    /** @readonly */
    rust,
}