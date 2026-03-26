FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

# Set the working directory to /app
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm curl \
    && npm install -g esbuild \
    && rm -rf /var/lib/apt/lists/*

    
# uv
COPY pyproject.toml pyproject.toml
RUN uv sync

# Copy all the files required to run the Flask app
COPY . .

# Expose the port and set the command
EXPOSE 8069

# The actual command to run
CMD ["sh", "-c", "$CMD"]
