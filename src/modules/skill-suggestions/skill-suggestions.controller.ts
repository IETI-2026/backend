import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { SuggestSkillDto } from './dto/suggest-skill.dto';
import { SkillSuggestionsService } from './skill-suggestions.service';

@Controller('skill-suggestions')
@UseGuards(JwtAuthGuard)
export class SkillSuggestionsController {
  private readonly logger = new Logger(SkillSuggestionsController.name);

  constructor(
    private readonly skillSuggestionsService: SkillSuggestionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async suggest(@Body() dto: SuggestSkillDto): Promise<{ message: string }> {
    this.logger.log(`POST /skill-suggestions - Skill: "${dto.name}"`);
    await this.skillSuggestionsService.suggestSkill(dto);
    return { message: 'Skill suggestion submitted successfully' };
  }
}
