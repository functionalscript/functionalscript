FROM debian

# Install basic tools
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    ca-certificates \
    build-essential \
    git \
    gnupg \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo install sccache --locked

# Install Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh

ENV DENO_INSTALL=/root/.deno
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Install Bun (official script)
RUN curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL=/root/.bun
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Clone FunctionalScript
RUN git clone https://github.com/functionalscript/functionalscript

WORKDIR /functionalscript

ENV CARGO_INCREMENTAL=0
ENV RUSTC_WRAPPER=sccache

RUN cargo test --no-run
RUN npm ci
