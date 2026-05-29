#!/bin/sh
# Usage: run.sh <runner> <scenario>
# runner: fjs | bun | node | deno | playwright
# scenario: path to a *.pass.f.ts, *.fail.f.ts, *.pass.ts or *.fail.ts file
set -e

runner=$1
scenario=$(realpath "$2")

scendir=$(cd "$(dirname "$0")" && pwd)

case "$scenario" in
    *.pass.f.ts) expected=0; scenfile="$scendir/_scenario.proof.f.ts" ;;
    *.fail.f.ts) expected=1; scenfile="$scendir/_scenario.proof.f.ts" ;;
    *.pass.ts)   expected=0; scenfile="$scendir/_scenario.proof.ts" ;;
    *.fail.ts)   expected=1; scenfile="$scendir/_scenario.proof.ts" ;;
    *) echo "unknown suffix: $scenario" >&2; exit 2 ;;
esac
allfile="$scendir/_all.test.ts"

ln "$scenario" "$scenfile"
ln "$scendir/all.ts" "$allfile"

cleanup() { rm -f "$scenfile" "$allfile"; }
trap cleanup EXIT

case "$runner" in
    fjs)        cmd="npm run fst" ;;
    bun)        cmd="bun test" ;;
    node)       cmd="node --test" ;;
    deno)       cmd="deno test --allow-read --allow-env" ;;
    playwright) cmd="npx playwright test" ;;
    *) echo "unknown runner: $runner" >&2; exit 2 ;;
esac

actual=0
(cd "$scendir" && $cmd) > /dev/null 2>&1 || actual=$?

if [ "$actual" -eq "$expected" ]; then
    echo "pass: $(basename "$scenario") [exit $actual]"
    exit 0
else
    echo "FAIL: $(basename "$scenario") [expected $expected, got $actual]"
    exit 1
fi
