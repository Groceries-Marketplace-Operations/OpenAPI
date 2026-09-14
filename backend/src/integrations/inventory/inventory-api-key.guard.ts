import { timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InventoryApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredKey = this.config.get<string>('INVENTORY_APP_SECRET');
    if (!configuredKey) {
      throw new ServiceUnavailableException('INVENTORY_APP_SECRET is not configured');
    }

    const receivedKey = context.switchToHttp().getRequest<Request>().header('api_key');
    if (!receivedKey || !this.matches(receivedKey, configuredKey)) {
      throw new UnauthorizedException('Invalid api_key');
    }

    return true;
  }

  private matches(receivedKey: string, configuredKey: string): boolean {
    const received = Buffer.from(receivedKey);
    const configured = Buffer.from(configuredKey);

    return received.length === configured.length && timingSafeEqual(received, configured);
  }
}
