import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

const ALLOWED_DOMAIN = 'didi-labs.com';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: Profile) {
    const email = profile.emails?.[0]?.value ?? '';
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw new UnauthorizedException('Domain not allowed');
    }

    let account = await this.prisma.account.findUnique({ where: { email } });
    if (!account) {
      account = await this.prisma.account.create({
        data: {
          email,
          name: profile.displayName ?? email,
          picture: profile.photos?.[0]?.value,
          roles: [Role.viewer],
        },
      });
    }

    return account;
  }
}
