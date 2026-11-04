import { BadRequestException, Injectable } from '@nestjs/common';
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
      include: { diDiConfig: { select: { id: true, appId: true, testAppId: true, updatedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        diDiConfig: { select: { id: true, appId: true, testAppId: true, testModeEnabled: true, testShops: true, updatedAt: true } },
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
    const existing = await this.prisma.diDiConfig.findUnique({ where: { projectId } });
    const appId = dto.appId.trim();
    const testAppId = dto.testAppId?.trim() ?? existing?.testAppId ?? null;
    if (!appId) throw new BadRequestException('Production App ID is required');
    if (testAppId === appId) throw new BadRequestException('Test and production App IDs must differ');
    if ((!existing || existing.appId !== appId) && !dto.appSecret) {
      throw new BadRequestException('Production App Secret is required for a new App ID');
    }
    if (testAppId && (!existing?.testAppSecret || existing.testAppId !== testAppId) && !dto.testAppSecret) {
      throw new BadRequestException('Test App Secret is required for a new App ID');
    }
    if (!testAppId && dto.testAppSecret) throw new BadRequestException('Test App ID is required');
    const encode = (secret: string) => this.encKey ? encrypt(secret, this.encKey) : secret;
    const data = {
      appId,
      appSecret: dto.appSecret ? encode(dto.appSecret) : existing!.appSecret,
      testAppId: testAppId || null,
      testAppSecret: testAppId ? (dto.testAppSecret ? encode(dto.testAppSecret) : existing?.testAppSecret) : null,
      testModeEnabled: dto.testModeEnabled ?? existing?.testModeEnabled ?? false,
      testShops: dto.testShops ?? existing?.testShops ?? [],
    };
    await this.prisma.diDiConfig.upsert({
      where: { projectId }, create: { projectId, ...data }, update: data,
    });
    return { success: true };
  }

  async updateTestMode(projectId: string, testModeEnabled: boolean, testShops: string[]) {
    await this.prisma.diDiConfig.update({
      where: { projectId }, data: { testModeEnabled, testShops },
    });
    return { success: true };
  }

  async getDiDiConfig(projectId: string) {
    const cfg = await this.prisma.diDiConfig.findUnique({ where: { projectId } });
    if (!cfg) return null;
    return {
      ...cfg,
      testAppSecret: cfg.testAppSecret && this.encKey ? decrypt(cfg.testAppSecret, this.encKey) : cfg.testAppSecret,
      appSecret: this.encKey ? decrypt(cfg.appSecret, this.encKey) : cfg.appSecret,
    };
  }
}
