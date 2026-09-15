{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/21a67dc470149f337cecafbe965d8d252a390518";
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
