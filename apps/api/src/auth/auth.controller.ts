import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser, Public } from "../common/decorators";
import type { RequestUser } from "../common/types";
import { env } from "../config/env";
import { AuthService, type IssuedTokens } from "./auth.service";
import {
  LoginDto,
  RefreshDto,
  RegisterDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  TokenDto,
} from "./dto";

const REFRESH_COOKIE = "jsl_rt";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProd,
      domain: env.cookieDomain,
      path: "/v1/auth",
      maxAge: env.refreshTokenTtlMs,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { domain: env.cookieDomain, path: "/v1/auth" });
  }

  private readRefresh(req: Request, body?: RefreshDto): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return body?.refreshToken ?? cookies?.[REFRESH_COOKIE];
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  @ApiOperation({ summary: "Create an account (status PENDING_EMAIL until the mailed link is opened)" })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, req.ip);
  }

  @Public()
  @Post("verify-email")
  @HttpCode(200)
  @ApiOperation({ summary: "Consume an email-verification token → account becomes PENDING_APPROVAL" })
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Password login → access token in body, rotating refresh token in httpOnly cookie" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<IssuedTokens, "refreshToken">> {
    const { refreshToken, ...rest } = await this.auth.login(dto, req.headers["user-agent"], req.ip);
    this.setRefreshCookie(res, refreshToken);
    return rest;
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate the refresh session; reuse of an old token revokes the whole family" })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<IssuedTokens, "refreshToken">> {
    const raw = this.readRefresh(req, body);
    if (!raw) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException("Missing refresh token.");
    }
    const { refreshToken, ...rest } = await this.auth.rotateRefresh(raw, req.headers["user-agent"], req.ip);
    this.setRefreshCookie(res, refreshToken);
    return rest;
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke the presented refresh session and clear the cookie" })
  async logout(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.readRefresh(req, body));
    this.clearRefreshCookie(res);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profile + org memberships of the authenticated user" })
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("request-password-reset")
  @HttpCode(202)
  @ApiOperation({ summary: "Always answers 202 — no account enumeration" })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<{ accepted: true }> {
    await this.auth.requestPasswordReset(dto.email);
    return { accepted: true };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(200)
  @ApiOperation({ summary: "Set a new password; revokes every open session" })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }
}
