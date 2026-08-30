{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/062346a6d85bc4b49dfaa61c986e9c5be21217d1";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_26 pkgs.typescript-go ];
        };
    };
}
