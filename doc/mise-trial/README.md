# mise development environment

This branch uses mise for development and every CI host. Install
[mise](https://mise.jdx.dev)
(2026.10.19 or newer) before initialization.

```sh
mise trust
mise install --locked
./dev.sh node --version
./dev.sh npm ci
./dev.sh tsc
./dev.sh npm start test
```

`./dev.sh` opens a Bash shell with `FJS ` prepended to the usual prompt after
loading `~/.bashrc`. Arguments run one command in the selected environment.
On Windows PowerShell, use `dev.ps1`:

```powershell
mise trust
mise install --locked
.\dev.ps1 node --version
.\dev.ps1 npm ci
.\dev.ps1 tsc
.\dev.ps1 npm start test
```

`.\dev.ps1` without arguments opens an interactive shell using the current
PowerShell executable (PowerShell 7 or Windows PowerShell 5.1). Its prompt starts
with `FJS `, followed by the shell's usual prompt. Run `exit` to leave it. With arguments, it runs one command and returns that command's exit
code. Both scripts are thin wrappers around `mise exec -- <command>`.

## Host prerequisites

| Host | Prerequisites |
| --- | --- |
| Linux | Native C compiler and libc headers |
| Linux x64 i686 | `gcc-multilib libc6-dev-i386` plus target standard library |
| macOS | Xcode Command Line Tools |
| Windows | MSVC build tools and Windows SDK; Git Bash for shell scripts |

Manager installations do not replace native build prerequisites or platform SDKs.

## Tool lock and optional runtimes

`mise.toml` and `mise.lock` select the central supported versions. Commit the
npm lock sidecars under `.mise/locks/` with manifest/lock updates. Run `mise lock`
then `mise install --locked` after changing pins; CI installs the committed lock.

SpiderMonkey uses the separate `mise.spidermonkey.toml` profile. On Linux ARM64:

```sh
mise -E spidermonkey lock http:spidermonkey --platform linux-arm64
mise -E spidermonkey install --locked http:spidermonkey
mise -E spidermonkey exec -- npm run sm t
```

The upstream checksum manifest is verified during optional runtime installation.
Wasmer has no native Windows ARM64 release; the baseline intentionally excludes
it there. CI exercises the WASM engines and SpiderMonkey on Linux ARM64.

## Claude Code cloud environment

A [Claude Code cloud environment](https://code.claude.com/docs/en/claude-code-on-the-web)
for this repository installs mise in its setup script, which runs once per new
session from the directory above the checkout:

```sh
cd functionalscript && sh .claude/setup.sh
```

[`.claude/setup.sh`](../../.claude/setup.sh) installs the Linux x64 host
prerequisites and mise, then runs `mise install --locked` and `npm ci`. The
session hook in `.claude/hooks/session-start.sh` repeats the last two steps,
which are no-ops once the setup script has run, and exports the selected tools
to the session's shell.

## Regeneration and updates

`./dev.sh npm run gen` writes all generated source and workflows using Node.
Tool lock updates are separate: update central pins and manifests together,
refresh manager locks for every platform and commit any npm sidecars. Run
scoped checks before pushing; CI validates all nine jobs. The generic `fjs ci`
command requires the caller's committed manager manifest and lock.
