{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/531670d871c0e29724a02f3cbcac170adc65b58c";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}
