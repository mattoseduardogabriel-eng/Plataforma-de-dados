import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
  // Token intermediário de 2FA (ver AuthService.signPendingTwoFactorToken)
  // — carrega só "essa pessoa já provou a senha, falta o código", nunca
  // dá acesso a rota nenhuma da API. Sem essa checagem aqui, alguém com a
  // senha certa mas sem o segundo fator conseguiria usar esse token pra
  // acessar dados mesmo assim (role/organizationId viriam undefined, o
  // que em alguma rota sem @Roles poderia vazar dado sem escopo de
  // organização nenhum) — esvaziaria o sentido do 2FA.
  pending2FA?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.pending2FA) {
      throw new UnauthorizedException('Login incompleto — confirme o código de 2FA.');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };
  }
}
