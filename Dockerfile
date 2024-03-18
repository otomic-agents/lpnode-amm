# base image
FROM docker.io/library/node:16.10.0-buster
#  file system
ADD ./ /data/lp_main/

# port information
EXPOSE 18081

# working directory
WORKDIR /data/lp_main/
# install dependencies
RUN apt-get update
RUN yes|apt-get install libusb-1.0-0-dev
RUN yes|apt-get install libudev-dev
RUN npm i
# build
RUN npx gulp
# CMD [ "node", "main.js" ]
CMD [ "node","--enable-source-maps", "dist/main.js" ]

