import "reflect-metadata";
import { Logger, ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { env } from "./config/env";

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.isProd ? ["log", "warn", "error"] : ["log", "warn", "error", "debug", "verbose"],
  });

  app.set("trust proxy", 1); // correct req.ip behind nginx / compose
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: env.appUrl,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" }); // → /v1/*
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();

  if (!env.isProd) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("JSL Imports API")
        .setDescription(
          "Japan→Sri Lanka vehicle-import platform. Rules are versioned data (ADR-002); " +
            "calculations run the shared @jsl/calc-engine (ADR-001) and record full provenance.",
        )
        .setVersion("0.3.0")
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup("docs", app, doc);
  }

  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(env.port);
  new Logger("Bootstrap").log(
    `JSL Imports API listening on :${env.port} (v1 at /v1, docs at ${env.isProd ? "disabled" : "/docs"})`,
  );
}

if (require.main === module) {
  void bootstrap();
}
