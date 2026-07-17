import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/crypto.util';
import { UpsertProjectDto } from './dto/upsert-project.dto';
import { UpsertDiDiConfigDto } from './dto/upsert-didi-config.dto';

@Injectable()
export class ProjectsService {
  private readonly encKey: string;

  constructor(private prisma: PrismaService, config: ConfigService) {
    this.encKey = config.get('APP_SECRET_ENCRYPTION_KEY') ?? '';
  }

  findAll() {
    return this.prisma.project.findMany({
      include: { diDiConfig: { select: { id: true, appId: true, updatedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        diDiConfig: { select: { id: true, appId: true, testModeEnabled: true, testShops: true, updatedAt: true } },
        orderEvents: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
  }

  create(dto: UpsertProjectDto) {
    return this.prisma.project.create({ data: dto });
  }

  update(id: string, dto: Partial<UpsertProjectDto>) {
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async upsertDiDiConfig(projectId: string, dto: UpsertDiDiConfigDto) {
    const appSecret = this.encKey ? encrypt(dto.appSecret, this.encKey) : dto.appSecret;
    const extra = {
      testModeEnabled: dto.testModeEnabled ?? false,
      testShops: dto.testShops ?? [],
    };
    return this.prisma.diDiConfig.upsert({
      where: { projectId },
      create: { projectId, appId: dto.appId, appSecret, ...extra },
      update: { appId: dto.appId, appSecret, ...extra },
    });
  }

  async updateTestMode(projectId: string, testModeEnabled: boolean, testShops: string[]) {
    return this.prisma.diDiConfig.update({
      where: { projectId },
      data: { testModeEnabled, testShops },
    });
  }

  async getDiDiConfig(projectId: string) {
    const cfg = await this.prisma.diDiConfig.findUnique({ where: { projectId } });
    if (!cfg) return null;
    return {
      ...cfg,
      appSecret: this.encKey ? decrypt(cfg.appSecret, this.encKey) : cfg.appSecret,
    };
  }
}
