import * as path from 'node:path';
import { MailConfig } from '@config/mail.config';
import { Logger, Module } from '@nestjs/common';
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
        const logger = new Logger('MailModule');
        const mailConfig = configService.get<MailConfig>('mail');

        if (!mailConfig) {
          logger.error(
            'Mail configuration not found. Ensure mail.config.ts is loaded.',
          );
          throw new Error(
            'Mail configuration not found. Ensure mail.config.ts is loaded.',
          );
        }

        // Resolver la ruta de plantillas
        // En runtime: __dirname es la carpeta del archivo compilado en dist/modules/mail
        const templatesDir = path.join(
          __dirname,
          'infrastructure',
          'templates',
        );

        logger.log(`Templates directory resolved to: ${templatesDir}`);

        const mailerConfig = {
          transport: {
            host: mailConfig.smtpHost,
            port: mailConfig.smtpPort,
            secure: mailConfig.smtpPort === 465,
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

        logger.log(
          `Mail module configured for SMTP host: ${mailConfig.smtpHost}:${mailConfig.smtpPort}`,
        );

        return mailerConfig;
      },
    }),
  ],
  providers: [MailService, NodemailerService],
  exports: [MailService],
})
export class MailModule {}
