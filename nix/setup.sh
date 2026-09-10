#!/bin/bash
# Sets up a container for this repository's Nix shell: a Claude Code on the
# web environment, or any other that starts from an image without Nix. Runs
# as root, needs nothing of the repository on disk, and leaves Nix installed
# with the shell of ./nix downloaded, so that `./nix/run` and `./dev.sh` in a
# checkout start at once. An environment that caches its filesystem after
# this script keeps all of it.
#
# The "Setup script" field of a Claude Code on the web environment fetches it
# from main:
#
#     curl -fsSL https://raw.githubusercontent.com/functionalscript/functionalscript/main/nix/setup.sh | bash
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

# The GitHub proxy of a Claude Code environment refuses the tarball Nix
# fetches a locked `github:` input as; a shallow git fetch of the locked
# revision lands in the store under the hash the lock names, and Nix uses it
# from there.
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
