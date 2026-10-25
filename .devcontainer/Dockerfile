FROM mcr.microsoft.com/devcontainers/base:debian
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl ca-certificates xz-utils && if [ "$(dpkg --print-architecture)" = amd64 ]; then apt-get install -y --no-install-recommends gcc-multilib libc6-dev-i386; fi && rm -rf /var/lib/apt/lists/*
ARG PIXI_VERSION=0.83.0
RUN arch="$(uname -m)" && curl -fsSL "https://github.com/prefix-dev/pixi/releases/download/v${PIXI_VERSION}/pixi-${arch}-unknown-linux-musl.tar.gz" -o /tmp/pixi.tar.gz && tar -xzf /tmp/pixi.tar.gz -C /usr/local/bin pixi && rm /tmp/pixi.tar.gz
USER vscode
RUN curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh && sh /tmp/rustup-init.sh -y --profile minimal --default-toolchain 1.99.1 && rm /tmp/rustup-init.sh
ENV PATH="/home/vscode/.cargo/bin:${PATH}"
