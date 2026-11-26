FROM node:20-alpine

WORKDIR /app

COPY mini-app/temp-upload-0.6.1/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY mini-app/temp-upload-0.6.1/ ./

ENV NODE_ENV=production
ENV YUGORNO_DATA_DIR=/data
ENV YUGORNO_UPLOAD_DIR=/data/uploads

CMD ["npm", "start"]
