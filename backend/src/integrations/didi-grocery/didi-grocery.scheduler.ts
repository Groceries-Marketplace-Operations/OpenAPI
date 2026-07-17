import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DiDiGroceryService } from './didi-grocery.service';

@Injectable()
export class DiDiGroceryScheduler {
  private readonly logger = new Logger(DiDiGroceryScheduler.name);

  constructor(private service: DiDiGroceryService) {}

  // Runs every minute, checks which configs match current time
  @Cron('* * * * *')
  async runScheduled() {
    const configs = await this.service.getActiveSchedules();
    if (!configs.length) return;

    for (const cfg of configs) {
      if (!cfg.project.active) continue;

      const now = new Date().toLocaleString('en-US', { timeZone: cfg.scheduleTimezone });
      const d = new Date(now);
      const currentHour = d.getHours();
      const currentMinute = d.getMinutes();

      if (currentHour !== cfg.scheduleHour || currentMinute !== cfg.scheduleMinute) continue;

      // Avoid double-run within the same minute
      if (cfg.lastRunAt) {
        const diffMs = Date.now() - new Date(cfg.lastRunAt).getTime();
        if (diffMs < 60_000) continue;
      }

      this.logger.log(`Scheduled upload triggered for project ${cfg.project.slug}`);
      try {
        await this.service.triggerUpload(cfg.project.slug, 'menu');
      } catch (err: any) {
        this.logger.error(`Scheduled upload failed for ${cfg.project.slug}: ${err.message}`);
      }
    }
  }
}
