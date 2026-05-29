#!/bin/sh
# Usage: run.sh <runner> <scenario>
# runner: bun | node | deno | playwright
# scenario: path to a *.pass.f.ts or *.fail.f.ts file
set -e

runner=$1
scenario=$(realpath "$2")

case "$scenario" in
    *.pass.f.ts) expected=0 ;;
    *.fail.f.ts) expected=1 ;;
    *) echo "unknown suffix: $scenario" >&2; exit 2 ;;
esac

scendir=$(cd "$(dirname "$0")" && pwd)
scenfile="$scendir/scenario.proof.f.ts"
allfile="$scendir/all.test.ts"

ln "$scenario" "$scenfile"
ln "$scendir/all.ts" "$allfile"

cleanup() { rm -f "$scenfile" "$allfile"; }
trap cleanup EXIT

case "$runner" in
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
