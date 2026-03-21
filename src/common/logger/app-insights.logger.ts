import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import * as appInsights from 'applicationinsights';

export class AppInsightsLogger extends ConsoleLogger {
  private readonly client: appInsights.TelemetryClient | null;

  constructor(context?: string, options?: { logLevels?: LogLevel[] }) {
    super(context ?? 'App', options ?? {});
    this.client = appInsights.defaultClient ?? null;
  }

  log(message: unknown, context?: string): void {
    context !== undefined ? super.log(message, context) : super.log(message);
    this.track(
      String(message),
      context,
      appInsights.KnownSeverityLevel.Information,
    );
  }

  warn(message: unknown, context?: string): void {
    context !== undefined ? super.warn(message, context) : super.warn(message);
    this.track(
      String(message),
      context,
      appInsights.KnownSeverityLevel.Warning,
    );
  }

  error(message: unknown, stack?: string, context?: string): void {
    context !== undefined
      ? super.error(message, stack, context)
      : super.error(message, stack);

    if (!this.client) return;

    const err = message instanceof Error ? message : new Error(String(message));
    this.client.trackException({
      exception: err,
      properties: {
        stack: stack ?? err.stack ?? '',
        context: context ?? this.context ?? '',
      },
    });
  }

  debug(message: unknown, context?: string): void {
    context !== undefined
      ? super.debug(message, context)
      : super.debug(message);
    this.track(
      String(message),
      context,
      appInsights.KnownSeverityLevel.Verbose,
    );
  }

  verbose(message: unknown, context?: string): void {
    context !== undefined
      ? super.verbose(message, context)
      : super.verbose(message);
    this.track(
      String(message),
      context,
      appInsights.KnownSeverityLevel.Verbose,
    );
  }

  private track(
    message: string,
    context: string | undefined,
    severity: string,
  ): void {
    if (!this.client) return;

    const ctx = context ?? this.context ?? '';
    this.client.trackTrace({
      message: ctx ? `[${ctx}] ${message}` : message,
      severity,
      properties: { context: ctx },
    });
  }
}
