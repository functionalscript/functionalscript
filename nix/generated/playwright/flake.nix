{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/21ea275a7c46aef9d4d6ddc962e6d562e9d94183";
    outputs = { nixpkgs, ... }: let
        pkgs = import nixpkgs {
            system = "aarch64-linux";
        };
    in
    {
        devShells.aarch64-linux.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_26 ];
            PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
            PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "ubuntu-24.04";
        };
        packages.aarch64-linux.oci = pkgs.dockerTools.streamLayeredImage {
            name = "functionalscript-playwright";
            tag = "21ea275a7c46aef9d4d6ddc962e6d562e9d94183";
            contents = [ pkgs.nodejs_26 pkgs.bashInteractive pkgs.coreutils pkgs.dockerTools.binSh pkgs.dockerTools.usrBinEnv pkgs.dockerTools.caCertificates pkgs.dockerTools.fakeNss ];
            config = {
                Env = [ "PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}" "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" "PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu-24.04" "PATH=/bin:/usr/bin" "HOME=/tmp" ];
                WorkingDir = "/workspace";
                Cmd = [ "/bin/sh" ];
            };
            extraCommands = ''
                mkdir -p tmp workspace
                chmod 1777 tmp
            '';
        };
    };
}
