FROM debian

# Install basic tools
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    build-essential \
    git \
    gnupg \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust via rustup
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo install sccache --locked

# Install Node.js (LTS via NodeSource)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/functionalscript/functionalscript

WORKDIR /functionalscript

ENV CARGO_INCREMENTAL=0
ENV RUSTC_WRAPPER=sccache

RUN cargo test --no-run
