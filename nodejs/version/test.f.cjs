const _ = require('./module.f.cjs')

const x = {
    "name": "functionalscript",
    "version": "0.1.0",
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
}

const e = '{\n' +
    '  "name": "functionalscript",\n' +
    '  "version": "0.0.2",\n' +
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

{
    /** @type {_.Node<string>} */
    const node = {
        child_process: { execSync: () => Buffer.from("123\n456\n") },
        fs: {
            readFileSync: () => Buffer.from(JSON.stringify(x)),
            writeFileSync: (_, content) => content
        }
    }
    const v = _.version(node)
    if (v !== e) { throw [v, e] }
}

module.exports = {}
