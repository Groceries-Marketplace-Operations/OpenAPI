import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccountsService } from './accounts.service';
import { Role } from '@prisma/client';

@Controller('accounts')
@Roles('admin')
export class AccountsController {
  constructor(private service: AccountsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Patch(':id/roles')
  setRole(@Param('id') id: string, @Body('roles') roles: Role[]) {
    return this.service.setRole(id, roles);
  }
}
