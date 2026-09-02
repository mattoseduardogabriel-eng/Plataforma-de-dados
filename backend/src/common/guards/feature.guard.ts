import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { FeaturesService } from '../../modules/features/features.service';

/**
 * Bloqueia uma rota decorada com `@RequireFeature('chave')` se a ferramenta
 * estiver desligada — pelo dono da plataforma (teto da empresa) ou pelo
 * ADMIN/GESTOR da própria empresa (setor/usuário). Rotas sem o decorator
 * passam direto, igual ao RolesGuard.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly featuresService: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    if (!user) return true; // deixa o JwtAuthGuard barrar quem não está autenticado

    const effective = await this.featuresService.getEffectiveFeatures(user.organizationId, user.id);
    if (!effective.has(featureKey)) {
      throw new ForbiddenException(
        'Esta ferramenta não está habilitada para sua empresa/usuário. Fale com o administrador.',
      );
    }
    return true;
  }
}
