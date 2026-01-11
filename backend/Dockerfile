FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

COPY gradle gradle
COPY gradlew .
COPY build.gradle .
COPY settings.gradle .

RUN chmod +x ./gradlew
RUN ./gradlew dependencies --no-daemon || true

COPY src src

RUN ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip ffmpeg nodejs npm && \
    pip3 install --break-system-packages yt-dlp && \
    ln -sf /usr/bin/yt-dlp /usr/local/bin/yt-dlp

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY --from=builder /app/build/libs/*.jar app.jar
COPY config /home/ubuntu/PLYST_1.0.2/backend/config

RUN mkdir -p /app/uploads /tmp && chown -R appuser:appgroup /app /tmp /home/ubuntu

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

ENTRYPOINT ["java", "-Xms512m", "-Xmx1024m", "-jar", "app.jar"]
