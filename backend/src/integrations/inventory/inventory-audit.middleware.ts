import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { InventoryAuditService } from './inventory-audit.service';

@Injectable()
export class InventoryAuditMiddleware implements NestMiddleware {
  constructor(private readonly audit: InventoryAuditService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const context = this.audit.createContext(request);
    let responsePayload: unknown;
    let finalized = false;
    const originalSend = response.send;

    response.setHeader('x-request-id', context.id);
    response.send = function send(body?: any): Response {
      responsePayload = body;
      return originalSend.call(this, body);
    };

    const finalize = () => {
      if (finalized) return;
      finalized = true;
      void this.audit.persist(context, response, responsePayload);
    };

    response.once('finish', finalize);
    response.once('close', finalize);
    this.audit.run(context, next);
  }
}
