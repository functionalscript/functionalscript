#!/bin/sh
set -eu
if [ "$#" -eq 0 ]; then
    case $0 in
        */*) startup=${0%/*}/dev.bashrc ;;
        *) startup=./dev.bashrc ;;
    esac
    set -- bash --rcfile "$startup"
fi
exec mise exec -- "$@"
