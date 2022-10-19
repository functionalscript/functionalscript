const { flat } = require('../../types/list/module.f.cjs')
const { join } = require('../../types/string/module.f.cjs')

const cppContent = require('../cpp/test.f.cjs').result

/** @typedef {'aix'|'darwin'|'freebsd'|'linux'|'openbsd'|'sunos'|'win32'} Platform */

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
 *  readonly line: string
 * }} Output
 */

/** @typedef {(nodejs: NodeJs) => Output} Func */

/** @type {Func} */
const cpp = ({dirname, platform}) => {
    const flags = platform === 'win32' ? [] : ['-std=c++11', '-lc++']
    return {
        file: {
            name: `${dirname}/cpp/_result.hpp`,
            content: cppContent,
        },
        line: join(' ')(flat([['clang'], flags, [dirname + '/cpp/main.cpp']])),
    }
}

module.exports = {
    /** @readonly */
    cpp,
}