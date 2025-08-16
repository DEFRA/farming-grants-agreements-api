ARG PARENT_VERSION=latest-22
ARG PORT=3000
ARG PORT_DEBUG=9229

# ---- development stage ----
FROM defradigital/node-development:${PARENT_VERSION} AS development
# Install Chromium & fonts (needed for local dev PDF gen)
USER root
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
USER node

ARG PORT
ARG PORT_DEBUG
ENV PORT=${PORT}
EXPOSE ${PORT} ${PORT_DEBUG}

COPY --chown=node:node package*.json ./
# Skip Puppeteer download since we use system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN npm install
COPY --chown=node:node . .
RUN npm run build

CMD ["npm","run","docker:dev"]

# ---- production stage ----
FROM defradigital/node:${PARENT_VERSION} AS production

USER root
# Healthcheck tool from your base plus Chromium deps
RUN apk update && apk add --no-cache \
    curl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

USER node

# Tell app where Chromium is
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

ARG JWT_ENABLED=true
ENV JWT_ENABLED=${JWT_ENABLED}

COPY --from=development /home/node/package*.json ./
COPY --from=development /home/node/.server ./.server/
COPY --from=development /home/node/.public ./.public/

RUN npm ci --omit=dev

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD ["node","."]