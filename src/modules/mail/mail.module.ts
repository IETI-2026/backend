import * as fs from 'node:fs';
import * as path from 'node:path';
import { MailConfig } from '@config/mail.config';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { MailService } from './application/mail.service';
import { NodemailerService } from './infrastructure/nodemailer.service';

function resolveTemplatesDir(logger: Logger): string {
  const possiblePaths = [
    path.resolve(
      process.cwd(),
      'src',
      'modules',
      'mail',
      'infrastructure',
      'templates',
    ),
    path.resolve(
      process.cwd(),
      'modules',
      'mail',
      'infrastructure',
      'templates',
    ),
    path.resolve(
      process.cwd(),
      'dist',
      'src',
      'modules',
      'mail',
      'infrastructure',
      'templates',
    ),
    path.resolve(
      process.cwd(),
      'dist',
      'modules',
      'mail',
      'infrastructure',
      'templates',
    ),
  ];

  for (const templatesPath of possiblePaths) {
    if (fs.existsSync(templatesPath)) {
      const files = fs
        .readdirSync(templatesPath)
        .filter((f) => f.endsWith('.hbs'));
      logger.log(
        `Templates directory resolved to: ${templatesPath} (${files.length} templates found)`,
      );
      return templatesPath;
    }
  }

  logger.warn(
    `No se encontró el directorio de templates en ubicaciones conocidas. Usando: ${possiblePaths[0]}`,
  );
  return possiblePaths[0];
}

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

        const templatesDir = resolveTemplatesDir(logger);

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
