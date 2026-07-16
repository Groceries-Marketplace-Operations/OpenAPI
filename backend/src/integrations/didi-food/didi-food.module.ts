import { Module } from '@nestjs/common';
import { DiDiFoodController } from './didi-food.controller';
import { DiDiFoodService } from './didi-food.service';
import { ProjectsModule } from '../../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [DiDiFoodController],
  providers: [DiDiFoodService],
})
export class DiDiFoodModule {}
