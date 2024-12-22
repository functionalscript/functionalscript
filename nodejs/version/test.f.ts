import * as _ from './module.f.ts'

const version = '0.3.0'

const x
    : { readonly[k in string]: unknown }
    = {
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

const buffer
    : (s: string) => _.Buffer
    = s => ({
    toString: () => s
})

export default () => {
    const node
        : _.Node<string>
        = {
        fs: {
            readFileSync: n => buffer(JSON.stringify(x[n])),
            writeFileSync: (_, content) => content
        }
    }
    const [n, d] = _.updateVersion(node)
    if (n !== e) { throw [n, e] }
}
