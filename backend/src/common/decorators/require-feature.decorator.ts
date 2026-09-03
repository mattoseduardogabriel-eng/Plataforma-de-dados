import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Marca uma rota como pertencente a uma "ferramenta" da plataforma que pode
 * ser desligada (pelo dono da plataforma pra empresa inteira, ou pelo
 * ADMIN/GESTOR da empresa por setor/usuário) — ver `FeatureGuard` e
 * `backend/src/common/features/platform-features.ts`.
 */
export const RequireFeature = (featureKey: string) => SetMetadata(REQUIRE_FEATURE_KEY, featureKey);
