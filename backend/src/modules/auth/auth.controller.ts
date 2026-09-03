import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    const isProd = this.configService.get('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Public()
  @Post('register-organization')
  async registerOrganization(@Body() dto: RegisterOrganizationDto) {
    // Não loga automaticamente: a empresa fica pendente de aprovação do
    // dono da plataforma (ver AuthService.registerOrganization).
    return this.authService.registerOrganization(dto);
  }

  // Sem isso, só o throttle global (200/60s por IP) valia aqui — folgado
  // demais pra login (dava pra tentar ~3 senhas por segundo). 10 tentativas
  // a cada 15min por IP é bem mais apertado, mesmo espírito do loginLimiter
  // do Liro CRM, sem travar alguém errando a senha algumas vezes.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...result } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Refresh token ausente.');
    }
    const { refreshToken, ...result } = await this.authService.refresh(token);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
