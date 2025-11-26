FROM ghcr.io/astral-sh/uv:python3.14-alpine

# Set the working directory to /app
WORKDIR /app

# Copy all the files required to run the Flask app
COPY . .

# Expose the port and set the command
EXPOSE 8069

# The actual command to run
CMD ["sh", "-c", "$CMD"]