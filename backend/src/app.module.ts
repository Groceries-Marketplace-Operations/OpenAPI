import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { ProjectsModule } from './projects/projects.module';
import { DiDiFoodModule } from './integrations/didi-food/didi-food.module';
import { DiDiGroceryModule } from './integrations/didi-grocery/didi-grocery.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AccountsModule,
    ProjectsModule,
    DiDiFoodModule,
    DiDiGroceryModule,
  ],
})
export class AppModule {}
