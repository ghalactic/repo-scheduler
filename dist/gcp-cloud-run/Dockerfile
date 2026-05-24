FROM node:24-slim
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY dist/ dist/
ENV PORT=8080
EXPOSE 8080
CMD ["npx", "functions-framework", "--target=schedule", "--source=."]
