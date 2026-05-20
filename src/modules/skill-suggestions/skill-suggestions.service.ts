import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import { SuggestSkillDto } from './dto/suggest-skill.dto';

@Injectable()
export class SkillSuggestionsService {
  private readonly logger = new Logger(SkillSuggestionsService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async suggestSkill(dto: SuggestSkillDto): Promise<void> {
    const endpointUrl = this.configService.get<string>(
      'SKILL_SUGGESTION_ENDPOINT_URL',
    );

    if (!endpointUrl) {
      this.logger.error('SKILL_SUGGESTION_ENDPOINT_URL is not configured');
      throw new InternalServerErrorException(
        'Skill suggestion endpoint is not configured',
      );
    }

    this.logger.log(`Forwarding skill suggestion: "${dto.name}"`);

    try {
      await lastValueFrom(
        this.httpService.post(endpointUrl, {
          name: dto.name,
          description: dto.description,
        }),
      );
    } catch (error) {
      if (isAxiosError(error)) {
        this.logger.error(
          `External endpoint returned error: status=${error.response?.status}`,
        );
        throw new BadGatewayException(
          'The skill suggestion could not be forwarded to the external service',
        );
      }
      throw error;
    }

    this.logger.log(`Skill suggestion forwarded successfully: "${dto.name}"`);
  }
}
