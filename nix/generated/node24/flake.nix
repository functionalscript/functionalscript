{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/f4f698677b11021a8f84f452e23ae9ef2427bec3";
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
