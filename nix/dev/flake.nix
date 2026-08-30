{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/062346a6d85bc4b49dfaa61c986e9c5be21217d1";
    inputs.rust-overlay.url = "github:oxalica/rust-overlay/996e9b0b019a4a9eb9e9a5641aefa06d801b5895";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { nixpkgs, rust-overlay, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" "rustfmt" ];
                targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-aarch64.zip";
                    hash = "sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=";
                };
            };
        in
        pkgs.mkShell {
            packages = [ rust pinned pkgs.nodejs_26 pkgs.deno pkgs.wasmtime pkgs.wasmer pkgs.git ];
        };
        devShells.x86_64-linux.default = let
            pkgs = import nixpkgs {
                system = "x86_64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" "rustfmt" ];
                targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-x64.zip";
                    hash = "sha256-LQP7X7g6yLVnrKCigbLOGhoZ1Ij1bClo2Iw/Jekv5FI=";
                };
            };
        in
        pkgs.mkShell {
            packages = [ rust pinned pkgs.nodejs_26 pkgs.deno pkgs.wasmtime pkgs.wasmer pkgs.git ];
        };
        devShells.aarch64-darwin.default = let
            pkgs = import nixpkgs {
                system = "aarch64-darwin";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" "rustfmt" ];
                targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-darwin-aarch64.zip";
                    hash = "sha256-xmnpf2Fk4cluBwF0jbmN+ndJKQjL2DlMdVcTSnNd44E=";
                };
            };
        in
        pkgs.mkShell {
            packages = [ rust pinned pkgs.nodejs_26 pkgs.deno pkgs.wasmtime pkgs.wasmer pkgs.git ];
        };
        devShells.x86_64-darwin.default = let
            pkgs = import nixpkgs {
                system = "x86_64-darwin";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" "rustfmt" ];
                targets = [ "wasm32-wasip1" "wasm32-wasip2" "wasm32-unknown-unknown" "wasm32-wasip1-threads" ];
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-darwin-x64-baseline.zip";
                    hash = "sha256-2pufG0unZsbymXEfON+qmGI+HtnECJaqU9uAPFLsH6A=";
                };
            };
        in
        pkgs.mkShell {
            packages = [ rust pinned pkgs.nodejs_26 pkgs.deno pkgs.wasmtime pkgs.wasmer pkgs.git ];
        };
    };
}
