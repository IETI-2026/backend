import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { SkillSuggestionsController } from './skill-suggestions.controller';
import { SkillSuggestionsService } from './skill-suggestions.service';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [SkillSuggestionsController],
  providers: [SkillSuggestionsService],
})
export class SkillSuggestionsModule {}
