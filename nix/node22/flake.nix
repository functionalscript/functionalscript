{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/1e8bc658fc985ef27ccd66d107d767b32bb7ef98";
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
