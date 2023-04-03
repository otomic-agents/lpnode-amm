# 基础镜像
FROM docker.io/library/node:16.10.0-buster
# 文件系统
ADD ./ /data/lp_main/

# 端口信息
EXPOSE 18081

# 工作目录
WORKDIR /data/lp_main/
# 安装依赖
RUN apt-get update
RUN yes|apt-get install libusb-1.0-0-dev
RUN yes|apt-get install libudev-dev
RUN npm i 
# build 
RUN npx gulp
# CMD [ "node", "main.js" ]
CMD [ "node", "dist/main.js" ]

