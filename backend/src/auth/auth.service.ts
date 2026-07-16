import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  login(account: { id: string; email: string; roles: string[] }) {
    const payload = { sub: account.id, email: account.email, roles: account.roles };
    return { accessToken: this.jwt.sign(payload) };
  }
}
