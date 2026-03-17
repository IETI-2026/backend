import * as path from 'node:path';
import { MailConfig } from '@config/mail.config';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailService } from './application/mail.service';
import { NodemailerService } from './infrastructure/nodemailer.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const mailConfig = configService.get<MailConfig>('mail');

        if (!mailConfig) {
          throw new Error(
            'Mail configuration not found. Ensure mail.config.ts is loaded.',
          );
        }

        const templatesDir = path.join(
          __dirname,
          'infrastructure',
          'templates',
        );

        return {
          transport: {
            host: mailConfig.smtpHost,
            port: mailConfig.smtpPort,
            secure: mailConfig.smtpPort === 465, // true para TLS (port 465), false para STARTTLS
            auth: {
              user: mailConfig.smtpUser,
              pass: mailConfig.smtpPassword,
            },
          },
          defaults: {
            from: mailConfig.mailFrom,
          },
          template: {
            dir: templatesDir,
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService, NodemailerService],
  exports: [MailService],
})
export class MailModule {}
