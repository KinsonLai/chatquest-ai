FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
COPY skills ./skills
COPY docs ./docs
COPY examples ./examples
RUN mkdir -p /data && chown node:node /data
USER node
ENV BRANCHWRIGHT_DB=/data/adventure.sqlite
EXPOSE 3333
VOLUME ["/data"]
ENTRYPOINT ["node", "src/cli.mjs", "--http", "--host", "0.0.0.0"]
