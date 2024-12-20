import * as list from '../../types/list/module.f.mjs'
const { flat } = list

import cppContent from '../cpp/testlib.f.ts'
import csContent from '../cs/testlib.f.mjs'
import rustContent from '../rust/testlib.f.mjs'

type Platform =
   | 'aix'
   | 'android'
   | 'darwin'
   | 'freebsd'
   | 'haiku'
   | 'linux'
   | 'openbsd'
   | 'sunos'
   | 'win32'
   | 'cygwin'
   | 'netbsd'

type NodeJs = {
   readonly dirname: string
   readonly platform: Platform
}

type Output ={
   readonly file: {
       readonly name: string
       readonly content: string
   }
   readonly line: list.List<list.List<string>>
}

export type Func = (nodejs: NodeJs) => Output

const flags
    : (platform: Platform) => readonly string[]
    = platform => {

    switch (platform) {
        case 'win32':
            return []
        case 'linux':
            return ['-std=c++17', '-lstdc++', '-fPIC']
        default:
            return ['-std=c++17', '-lc++']
    }
}

const output
    : (platform: Platform) => (name: string) => string
    = platform => name => {

    switch (platform) {
        case 'win32': return `${name}.dll`
        case 'darwin': return `lib${name}.dylib`
        default: return `lib${name}.so`
    }
}

const cpp
    : Func
    = ({ dirname, platform }) => ({

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

const cs
    : Func
    = ({ dirname, platform }) => ({

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

const rust
: Func
= ({ dirname }) => ({
    file: {
        name: `${dirname}/rust/src/_result.rs`,
        content: rustContent,
    },
    line: [['cargo', 'build' /**, '--locked' */]]
})

export default {
    /** @readonly */
    cpp,
    /** @readonly */
    cs,
    /** @readonly */
    rust,
}
