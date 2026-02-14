import { utf8, utf8ToString } from '../../text/module.f.ts'
import { isVec } from '../../types/bit_vec/module.f.ts'
import { run } from '../../types/effect/mock/module.f.ts'
import { all } from '../../types/effect/module.f.ts'
import { type NodeOperations, writeFile } from '../../types/effect/node/module.f.ts'
import { emptyState, virtual } from '../../types/effect/node/virtual/module.f.ts'
import { decodeUtf8, encodeUtf8 } from '../../types/uint8array/module.f.ts'
import * as _ from './module.f.ts'
import { updateVersion2 } from './module.f.ts'

const version = '0.3.0'

const x: { readonly[k in string]: unknown } = {
    'package.json': {
        "name": "functionalscript",
        version,
        "description": "FunctionalScript is a functional subset of JavaScript",
        "main": "module.f.cjs",
        "scripts": {
            "tsc": "tsc",
            "test": "tsc && npm run test-only",
            "version": "node ./nodejs/version/main.cjs",
            "test-only": "node --trace-uncaught ./test.f.cjs"
        },
        "repository": {
            "type": "git",
            "url": "git+https://github.com/functionalscript/functionalscript.git"
        },
        "author": "NatFoam",
        "license": "MIT",
        "keywords": [
            "lambda",
            "functional-programming",
            "closure",
            "pure-functional",
            "typescript",
            "programming-language",
            "lazy-evaluation"
        ],
        "bugs": {
            "url": "https://github.com/functionalscript/functionalscript/issues"
        },
        "homepage": "https://github.com/functionalscript/functionalscript#readme",
        "devDependencies": {
            "@types/node": "^18.6.2",
            "typescript": "^4.7.4"
        }
    },
    "deno.json": {}
}

const e = '{\n' +
    '  "name": "functionalscript",\n' +
    `  "version": "${version}",\n` +
    '  "description": "FunctionalScript is a functional subset of JavaScript",\n' +
    '  "main": "module.f.cjs",\n' +
    '  "scripts": {\n' +
    '    "tsc": "tsc",\n' +
    '    "test": "tsc && npm run test-only",\n' +
    '    "version": "node ./nodejs/version/main.cjs",\n' +
    '    "test-only": "node --trace-uncaught ./test.f.cjs"\n' +
    '  },\n' +
    '  "repository": {\n' +
    '    "type": "git",\n' +
    '    "url": "git+https://github.com/functionalscript/functionalscript.git"\n' +
    '  },\n' +
    '  "author": "NatFoam",\n' +
    '  "license": "MIT",\n' +
    '  "keywords": [\n' +
    '    "lambda",\n' +
    '    "functional-programming",\n' +
    '    "closure",\n' +
    '    "pure-functional",\n' +
    '    "typescript",\n' +
    '    "programming-language",\n' +
    '    "lazy-evaluation"\n' +
    '  ],\n' +
    '  "bugs": {\n' +
    '    "url": "https://github.com/functionalscript/functionalscript/issues"\n' +
    '  },\n' +
    '  "homepage": "https://github.com/functionalscript/functionalscript#readme",\n' +
    '  "devDependencies": {\n' +
    '    "@types/node": "^18.6.2",\n' +
    '    "typescript": "^4.7.4"\n' +
    '  }\n' +
    '}'

export default {
    old: () => {
        const node
            : _.Node<string>
            = {
            fs: {
                readFileSync: n => encodeUtf8(JSON.stringify(x[n])),
                writeFileSync: (_, content) => decodeUtf8(content)
            }
        }
        const [n, d] = _.updateVersion(node)
        if (n !== e) { throw [n, e] }
    },
    new: () => {
        const rv = run(virtual)
        const w = (name: string) => {
            const fn = `${name}.json`
            return writeFile<NodeOperations>(fn, utf8(JSON.stringify(x[fn])))
        }
        const [state] = rv(emptyState)(all([w('package'), w('deno')]))
        const [newState, result] = rv(state)(updateVersion2)
        if (result !== 0) { throw result }
        const vec = newState.root['package.json']
        if (!isVec(vec)) { throw vec }
        const n = utf8ToString(vec)
        if (n !== e) { throw [n, e] }
    }
}
