# Use the official Deno Alpine image as the base
FROM denoland/deno:alpine-2.1.3

# Set the working directory in the container
WORKDIR /app

# Copy the application files to the container
COPY . .

# Install dependencies
RUN deno cache main.ts


# Run the application
CMD ["deno", "task", "start"]
