# FunctionalScript

[![NPM Version](https://img.shields.io/npm/v/functionalscript)](https://www.npmjs.com/package/functionalscript)

FunctionalScript is a safe, purely functional programming language and a strict subset of
[ECMAScript](https://en.wikipedia.org/wiki/ECMAScript)/[JavaScript](https://en.wikipedia.org/wiki/JavaScript). It's inspired by

- [JSON](https://en.wikipedia.org/wiki/JSON) and [JSON5](https://json5.org/) as subsets of JavaScript.
  JSON is also a subset of FunctionalScript.
- [asm.JS](https://en.wikipedia.org/wiki/Asm.js) (a precursor of [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly)),
  as a subset of JavaScript.
- [TypeScript](https://en.wikipedia.org/wiki/TypeScript), as a superset of JavaScript.

[A working draft of the FunctionalScript specification](./todo/lang/README.md).

Learn more about

- [Purely Functional Programming in JavaScript](https://blog.bitsrc.io/purely-functional-programming-in-javascript-91114b1b2dff?sk=5f7132e56902f38fcf4c6164bfa681ed),
- [FunctionalScript and I/O](https://medium.com/@sergeyshandar/functionalscript-5cf817345376?sk=30b32189a81d1a2dad16c2244f32328d).

This repository is a [monorepo](https://en.wikipedia.org/wiki/Monorepo) and distributed under [MIT](LICENSE).

## Getting Started

Install FunctionalScript via npm:

```bash
npm install -g functionalscript
```

The `fjs` CLI provides several commands:

| Command          | Description                                               |
|------------------|-----------------------------------------------------------|
| `fjs test` / `t` | Run the FunctionalScript test suite                       |
| `fjs compile` / `c` | Compile a `.f.ts` module to JavaScript                 |
| `fjs run` / `r`  | Run a FunctionalScript module as a Node program           |
| `fjs cas` / `s`  | Content-addressable storage (`add`, `get`, `list`)        |
| `fjs mcp` / `m`  | Run an MCP server over stdio exposing the CAS as tools    |
| `fjs ci` / `i`   | Generate the GitHub Actions CI workflow                   |

### Content-Addressable Storage (CAS)

FunctionalScript ships a built-in CAS for storing and retrieving blobs by their cryptographic hash:

```bash
fjs cas add myfile.txt   # store a file, print its cBase32 hash
fjs cas get <hash>       # restore a blob by hash
fjs cas list             # list all stored hashes
```

Blobs are stored under `~/.cas/` and addressed by their SHA-256 hash encoded in cBase32.

### MCP Server

The CAS is also exposed as an [MCP](https://modelcontextprotocol.io/) server so LLM agents can read and write blobs without a shell:

```bash
# register with Claude CLI
claude mcp add cas -- npx functionalscript m
```

See [`fjs/cas/mcp/README.md`](fjs/cas/mcp/README.md) for details on the `cas_add`, `cas_get`, and `cas_list` tools.

### Using MCP with VS Code

This repository keeps `.copilot/mcp.json` as the source of truth. VS Code auto-discovers `.vscode/mcp.json`; that file is **not committed** — it is generated locally from the canonical config.

One-time setup in your local clone:

1. Enable repository hooks:

```bash
git config core.hooksPath .githooks
```

2. Generate `.vscode/mcp.json` immediately (optional, the hooks will also create it on the next checkout/commit):

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-mcp.ps1 -Mode sync
# or:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-mcp.ps1 -Mode sync
```

After that, the hooks keep `.vscode/mcp.json` up to date automatically:
- **pre-commit** — re-syncs before every commit, including when `.copilot/mcp.json` is partially staged, and guards against direct edits to `.vscode/mcp.json`;
- **post-merge / post-checkout** — re-syncs after a merge, pull, checkout, or file restore, and only warns if sync cannot run.
- **post-rewrite** — re-syncs after amend/rebase operations, and only warns if sync cannot run.

To update MCP config, edit `.copilot/mcp.json` only. The hooks propagate the change to `.vscode/mcp.json`.

#### Using the MCP Tools in Chat

Once configured, open Copilot Chat (`Ctrl+Alt+I` on Windows/Linux, `Cmd+Option+I` on macOS), select **Agent**, then use **Configure Tools** to enable the MCP tools. Try a prompt like:

> "Add a short text blob to CAS: 'Hello from FunctionalScript'"

The MCP tools (`cas_add`, `cas_get`, `cas_list`) will be available in the agent's tool panel. For more details on the tools and examples, see [`fjs/cas/mcp/README.md`](fjs/cas/mcp/README.md).

## Vision

We aim to create a safe, cross-platform programming language that can work in any JS platform without any build step. There are thousands of programming languages, and we don't want to create another one that others must learn. Instead, we take the opposite approach: we remove everything that makes the most popular and cross-platform language unsafe, insecure, or less portable.

## Applications

FunctionalScript code can be used:

- safely in any JavaScript/TypeScript application or library;
- as a JSON with expressions, see [DJS](https://medium.com/@sasha.gil/bridging-the-gap-from-json-to-javascript-without-dsls-fee273573f1b);
- as a query language;
- as a smart contract programming language in DeFi.

## Design Principles

In FunctionalScript:

- Any module is a valid JavaScript module. No additional build steps are required.
- Code should not have [side-effects](https://en.wikipedia.org/wiki/Side_effect_(computer_science)). Any JavaScript statement, expression, or function that has a side effect is not allowed in FunctionalScript. There are no exceptions to this rule, such as `unsafe` code, which can be found in Rust, C#, and other languages.
- A module can depend only on another FunctionalScript module.
- It also has no standard library. Only a safe subset of standard JavaScript API can be used without referencing other modules.

## Sponsors

- [KirillOsenkov](https://github.com/KirillOsenkov),
- [antkmsft](https://github.com/antkmsft),
- [Mark Heyman](https://opencollective.com/body-count).
