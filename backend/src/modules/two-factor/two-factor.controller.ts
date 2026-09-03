import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TwoFactorService } from './two-factor.service';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

// 2FA só disponível pra ADMIN/GESTOR — são as contas com acesso
// gerencial completo na empresa, as que mais importa proteger com um
// segundo fator.
@ApiTags('2fa')
@Roles(Role.ADMIN, Role.GESTOR)
@Controller('2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.status(user.id);
  }

  @Post('setup')
  setup(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.setup(user.id, user.email);
  }

  @Post('enable')
  enable(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyTwoFactorDto) {
    return this.twoFactorService.enable(user.id, user.organizationId, dto.token);
  }

  @Post('disable')
  disable(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyTwoFactorDto) {
    return this.twoFactorService.disable(user.id, user.organizationId, dto.token, dto.password);
  }
}
