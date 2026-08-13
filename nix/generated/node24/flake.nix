{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/9f78f44a87948854445dae0b6bf82b2e87e4efb5";
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
