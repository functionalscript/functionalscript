#!/bin/sh
# Linux tools missing from the Pixi binary channel. One tool per CI step.
# Keep archive companions: SpiderMonkey needs its bundled NSPR libraries.
set -eu

tool=${1:?usage: install-supplements.sh wasmtime|spidermonkey VERSION}
version=${2:?usage: install-supplements.sh wasmtime|spidermonkey VERSION}
case $(uname -s) in Linux) ;; *) echo 'These CI supplements require Linux' >&2; exit 1 ;; esac
case $(uname -m) in
    aarch64|arm64) arch=aarch64 ;;
    x86_64) arch=x86_64 ;;
    *) echo 'Unsupported native architecture' >&2; exit 1 ;;
esac
case $tool in
    wasmtime|spidermonkey) ;;
    *) echo 'Unknown CI supplement' >&2; exit 1 ;;
esac

project=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
prefix=$project/.pixi/ci-tools
mkdir -p "$prefix/bin"
scratch=$(mktemp -d "$prefix/.download.XXXXXX")
trap 'rm -rf "$scratch"' EXIT HUP INT TERM
mkdir "$scratch/unpacked"

case $tool in
    wasmtime)
        # GitHub release asset SHA-256 digests, checked on 2026-10-24:
        # https://api.github.com/repos/bytecodealliance/wasmtime/releases/tags/v45.0.2
        # Refuse a pin update until its native archive digests are reviewed.
        case $version/$arch in
            45.0.2/aarch64) digest=844ccd7dced4cd5afa3ede9baf953ee24577ea7f4276c401528aba6c23c197a3 ;;
            45.0.2/x86_64) digest=1adc4ffbd92c2520fcd161bce953f8c9a9569e14461365780dbcff20f1accec9 ;;
            *) echo 'Review the Wasmtime archive checksum for this pin' >&2; exit 1 ;;
        esac
        archive=wasmtime-v$version-$arch-linux.tar.xz
        curl --fail --silent --show-error --location --retry 3 "https://github.com/bytecodealliance/wasmtime/releases/download/v$version/$archive" -o "$scratch/archive"
        printf '%s  %s\n' "$digest" "$scratch/archive" | sha256sum --check
        tar -xJf "$scratch/archive" --strip-components=1 -C "$scratch/unpacked"
        test -x "$scratch/unpacked/wasmtime"
        ;;
    spidermonkey)
        # A fixed release's publisher manifest supplies the digest at install
        # time. This is integrity verification, not a committed archive lock.
        # Mozilla was inaccessible from the development session's network.
        case $version in
            *[!0-9.]*|'') echo 'Invalid SpiderMonkey version' >&2; exit 1 ;;
        esac
        base=https://archive.mozilla.org/pub/firefox/releases/${version}esr
        archive=jsshell-linux-$arch.zip
        curl --fail --silent --show-error --location --retry 3 "$base/SHA256SUMS" -o "$scratch/SHA256SUMS"
        awk -v archive="jsshell/$archive" -v target="$scratch/archive" '
            $2 == archive { print $1 "  " target; found++ }
            END { if (found != 1) exit 1 }
        ' "$scratch/SHA256SUMS" > "$scratch/checksum"
        curl --fail --silent --show-error --location --retry 3 "$base/jsshell/$archive" -o "$scratch/archive"
        sha256sum --check "$scratch/checksum"
        unzip -q "$scratch/archive" -d "$scratch/unpacked"
        test -x "$scratch/unpacked/js"
        ;;
esac

rm -rf "$prefix/$tool"
mv "$scratch/unpacked" "$prefix/$tool"
case $tool in
    wasmtime) ln -sf "$prefix/wasmtime/wasmtime" "$prefix/bin/wasmtime" ;;
    spidermonkey) ln -sf "$prefix/spidermonkey/js" "$prefix/bin/js" ;;
esac
