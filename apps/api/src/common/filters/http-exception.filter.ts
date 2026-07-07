import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client";

/**
 * One error shape everywhere:
 * { statusCode, error, message, path, timestamp }
 * message may be a string[] (class-validator) or a string.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";
    let message: string | string[] = "Something went wrong";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
        error = exception.name;
      } else {
        const b = body as { error?: string; message?: string | string[] };
        error = b.error ?? exception.name;
        message = b.message ?? exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Friendly mapping for the common integrity failures.
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        error = "Conflict";
        message = "A record with the same unique value already exists.";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        error = "Not Found";
        message = "The requested record does not exist.";
      } else {
        this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
      }
    } else if (exception instanceof Error && exception.message.startsWith("[rules:")) {
      // calc-engine buildRuleSet/assertTaxRules structural failures — the
      // message names the domain and the exact violated invariant.
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      error = "Rule Validation Failed";
      message = exception.message;
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error(String(exception));
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
