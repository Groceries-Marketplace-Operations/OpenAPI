import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { DiDiGroceryService } from './didi-grocery.service';
import { DiDiGroceryController } from './didi-grocery.controller';
import { DiDiGroceryScheduler } from './didi-grocery.scheduler';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [DiDiGroceryService, DiDiGroceryScheduler],
  controllers: [DiDiGroceryController],
  exports: [DiDiGroceryService],
})
export class DiDiGroceryModule {}
