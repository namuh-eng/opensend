FROM golang:1.23-alpine AS build
WORKDIR /src
COPY services/ingester-go/go.mod ./
RUN go mod download
COPY services/ingester-go/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/ingester-go .

FROM alpine:3.21
RUN addgroup -S opensend && adduser -S opensend -G opensend
USER opensend
COPY --from=build /out/ingester-go /usr/local/bin/ingester-go
ENV HOST=0.0.0.0 PORT=3027
EXPOSE 3027
ENTRYPOINT ["/usr/local/bin/ingester-go"]
