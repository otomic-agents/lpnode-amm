# base image
FROM docker.io/library/node:20.11.0-buster

# Install ts-node globally
RUN npm install -g ts-node typescript
RUN npm install -g @nestjs/cli
# Add source files
ADD ./ /data/lp_main/

# Expose port
EXPOSE 18081

# Set working directory  
WORKDIR /data/lp_main/

# Install system dependencies
RUN apt-get update
RUN yes|apt-get install libusb-1.0-0-dev
RUN yes|apt-get install libudev-dev

# Install npm dependencies
RUN npm i

# Add version info for debugging
RUN node -v && npm -v && ts-node -v

# Run build process
RUN nest build

# Start with ts-node
CMD [ "node", "dist/main.js" ]
