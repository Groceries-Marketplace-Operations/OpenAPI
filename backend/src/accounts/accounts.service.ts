import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.account.findMany({ orderBy: { createdAt: 'asc' } });
  }

  setRole(id: string, roles: Role[]) {
    return this.prisma.account.update({ where: { id }, data: { roles } });
  }
}
