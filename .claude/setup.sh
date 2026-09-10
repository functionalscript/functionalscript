#!/bin/bash
# The setup script of the Claude Code on the web environment. Paste it into
# the environment's "Setup script" field at claude.ai/code.
#
# It runs once, before any session; the environment then caches the
# filesystem, so every session starts with Nix installed and the development
# shell of ./nix already downloaded. The hook in ./hooks/session-start.sh
# does the rest per session.
set -euo pipefail

# Nix, single-user, as root: the installer creates no build users, so Nix must
# not expect the group.
mkdir -p /etc/nix
printf 'build-users-group =\nexperimental-features = nix-command flakes\n' > /etc/nix/nix.conf
curl -fsSL https://channels.nixos.org/nix-latest/install | sh -s -- --no-daemon --yes
export USER=root
. /root/.nix-profile/etc/profile.d/nix.sh

# The shell, from a throwaway clone of main.
git clone --depth 1 https://github.com/functionalscript/functionalscript /tmp/functionalscript
cd /tmp/functionalscript

# The environment's GitHub proxy refuses the tarball Nix fetches a locked
# `github:` input as; a shallow git fetch of the locked revision lands in the
# store under the hash the lock names, and Nix uses it from there.
nix eval --raw --impure --expr '
    let
        lock = builtins.fromJSON (builtins.readFile ./nix/flake.lock);
        nodes = builtins.attrValues lock.nodes;
        github = builtins.filter (n: n ? locked && n.locked.type == "github") nodes;
        url = n: "git+https://github.com/${n.locked.owner}/${n.locked.repo}?rev=${n.locked.rev}&shallow=1\n";
    in
    builtins.concatStringsSep "" (map url github)
' | while read -r input; do
    nix flake prefetch --quiet "$input"
done

./nix/run true

cd /
rm -rf /tmp/functionalscript
