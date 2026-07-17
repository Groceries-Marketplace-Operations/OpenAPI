import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsArray, IsString } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectsService } from './projects.service';
import { UpsertProjectDto } from './dto/upsert-project.dto';
import { UpsertDiDiConfigDto } from './dto/upsert-didi-config.dto';

class UpdateTestModeDto {
  @IsBoolean() testModeEnabled: boolean;
  @IsArray() @IsString({ each: true }) testShops: string[];
}

@Controller('projects')
export class ProjectsController {
  constructor(private service: ProjectsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('admin')
  create(@Body() dto: UpsertProjectDto) { return this.service.create(dto); }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpsertProjectDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/didi-config')
  @Roles('admin')
  upsertDiDiConfig(@Param('id') id: string, @Body() dto: UpsertDiDiConfigDto) {
    return this.service.upsertDiDiConfig(id, dto);
  }

  @Patch(':id/didi-config/test-mode')
  @Roles('admin')
  updateTestMode(@Param('id') id: string, @Body() dto: UpdateTestModeDto) {
    return this.service.updateTestMode(id, dto.testModeEnabled, dto.testShops);
  }
}
