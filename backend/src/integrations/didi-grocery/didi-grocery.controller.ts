import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { DiDiGroceryService } from './didi-grocery.service';

class UpsertGroceryConfigDto {
  @IsString() sftpHost: string;
  @IsNumber() sftpPort: number;
  @IsString() sftpUser: string;
  @IsString() sftpPassword: string;
  @IsString() sftpRemoteDir: string;
  @IsNumber() maxPerCategory: number;
  @IsBoolean() scheduleEnabled: boolean;
  @IsNumber() @Min(0) @Max(23) scheduleHour: number;
  @IsNumber() @Min(0) @Max(59) scheduleMinute: number;
  @IsString() scheduleTimezone: string;
}

class TriggerDto {
  @IsOptional() @IsString() mode?: 'menu' | 'stock';
}

@Controller('didi/:slug/grocery')
export class DiDiGroceryController {
  constructor(private service: DiDiGroceryService) {}

  @Get('config')
  @Roles('admin')
  async getConfig(@Param('slug') slug: string) {
    const project = await this.service['prisma'].project.findUnique({ where: { slug } });
    if (!project) return null;
    return this.service.getConfigPublic(project.id);
  }

  @Post('config')
  @Roles('admin')
  async upsertConfig(@Param('slug') slug: string, @Body() dto: UpsertGroceryConfigDto) {
    const project = await this.service['prisma'].project.findUnique({ where: { slug } });
    if (!project) throw new Error('Project not found');
    return this.service.upsertConfig(project.id, dto);
  }

  @Post('trigger')
  @Roles('admin')
  trigger(@Param('slug') slug: string, @Body() dto: TriggerDto) {
    return this.service.triggerUpload(slug, dto.mode ?? 'menu');
  }

  @Get('uploads')
  @Roles('admin')
  async listUploads(@Param('slug') slug: string) {
    const project = await this.service['prisma'].project.findUnique({ where: { slug } });
    if (!project) return [];
    return this.service.listUploads(project.id);
  }

  @Post('uploads/:uploadId/check-tasks')
  @Roles('admin')
  checkTasks(@Param('uploadId') uploadId: string) {
    return this.service.checkTasks(uploadId);
  }
}
