{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/da6dc0e7b26060f2f71ce3ef7088fb56ee44fa36";
    inputs.rust-overlay.url = "git+https://github.com/oxalica/rust-overlay?ref=master&rev=ec07af44be2e0ce4e1a17e00a97d44232607c1ec";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { self, nixpkgs, rust-overlay, ... }: let
        shell = { pkgs, targets, shellHook, url, hash, ... }: let
            rust = pkgs.rust-bin.stable."1.99.1".minimal.override {
                extensions = [ "clippy" "rustfmt" ];
                targets = targets;
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.4";
                src = pkgs.fetchurl {
                    url = url;
                    hash = hash;
                };
            };
        in
        pkgs.mkShell {
            packages = [ rust pinned pkgs.nodejs_26 pkgs.deno pkgs.typescript-go pkgs.wasmtime pkgs.wasmer pkgs.spidermonkey_140 pkgs.git ];
            shellHook = shellHook;
        };
    in
    {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            shellHook = "";
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-aarch64.zip";
            hash = "sha256-uqa7NvUdblhWHgK76oJQOKnfRU9nPW13bou/hvjHhQ4=";
        };
        devShells.x86_64-linux.default = let
            pkgs = import nixpkgs {
                system = "x86_64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" "i686-unknown-linux-gnu" ];
            shellHook = ''
                export CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER=${pkgs.pkgsi686Linux.stdenv.cc}/bin/cc
            '';
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-x64.zip";
            hash = "sha256-v4zL+ysLgBWeD5ptFcVTF63YB3U028YTCj7bUvzLOVw=";
        };
        devShells.aarch64-darwin.default = let
            pkgs = import nixpkgs {
                system = "aarch64-darwin";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            shellHook = "";
            url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-darwin-aarch64.zip";
            hash = "sha256-wkDX8My5DCY6hJ/NsJt+5iYw2SE0jtaq/ahrnVd7xRA=";
        };
        packages.aarch64-linux.devTools = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            extraTools = [ pkgs.stdenv.cc ];
            toolLists = [ self.devShells.aarch64-linux.default.nativeBuildInputs extraTools ];
        in
        pkgs.buildEnv {
            name = "fjs-dev-tools";
            paths = pkgs.lib.concatLists toolLists;
            extraOutputsToInstall = [ "out" "bin" ];
            pathsToLink = [ "/bin" ];
        };
        packages.x86_64-linux.devTools = let
            pkgs = import nixpkgs {
                system = "x86_64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            command0 = pkgs.writeShellApplication {
                name = "fjs-i686-cc";
                text = ''
                    exec ${pkgs.pkgsi686Linux.stdenv.cc}/bin/cc "$@"
                '';
            };
            extraTools = [ pkgs.stdenv.cc command0 ];
            toolLists = [ self.devShells.x86_64-linux.default.nativeBuildInputs extraTools ];
        in
        pkgs.buildEnv {
            name = "fjs-dev-tools";
            paths = pkgs.lib.concatLists toolLists;
            extraOutputsToInstall = [ "out" "bin" ];
            pathsToLink = [ "/bin" ];
        };
        packages.aarch64-darwin.devTools = let
            pkgs = import nixpkgs {
                system = "aarch64-darwin";
                overlays = [ rust-overlay.overlays.default ];
            };
            extraTools = [ pkgs.stdenv.cc ];
            toolLists = [ self.devShells.aarch64-darwin.default.nativeBuildInputs extraTools ];
        in
        pkgs.buildEnv {
            name = "fjs-dev-tools";
            paths = pkgs.lib.concatLists toolLists;
            extraOutputsToInstall = [ "out" "bin" ];
            pathsToLink = [ "/bin" ];
        };
    };
}
