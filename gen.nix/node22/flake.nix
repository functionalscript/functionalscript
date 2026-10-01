{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/78e9c786dc08cd4f3420c2395cd977206a9b1da2";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
        };
    };
}
