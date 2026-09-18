{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/4c7870105e7f1fdf9c48688c8d7efc21abf0688a";
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
