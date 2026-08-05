{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/04607e1165ac22c5fde6dcc54c9e0b3c0487c555";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_26 ];
        };
    };
}
