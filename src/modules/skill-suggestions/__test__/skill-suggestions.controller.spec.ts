import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { SuggestSkillDto } from '../dto/suggest-skill.dto';
import { SkillSuggestionsController } from '../skill-suggestions.controller';
import { SkillSuggestionsService } from '../skill-suggestions.service';

describe('SkillSuggestionsController', () => {
  let controller: SkillSuggestionsController;
  let service: { suggestSkill: jest.Mock };

  const dto: SuggestSkillDto = {
    name: 'Electrician',
    description: 'Electrical wiring and repairs',
  };

  beforeEach(async () => {
    service = { suggestSkill: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkillSuggestionsController],
      providers: [{ provide: SkillSuggestionsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SkillSuggestionsController>(
      SkillSuggestionsController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('suggest', () => {
    it('should delegate to the service and return a success message', async () => {
      service.suggestSkill.mockResolvedValue(undefined);

      const result = await controller.suggest(dto);

      expect(service.suggestSkill).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'Skill suggestion submitted successfully',
      });
    });

    it('should propagate InternalServerErrorException when endpoint is not configured', async () => {
      service.suggestSkill.mockRejectedValue(
        new InternalServerErrorException(
          'Skill suggestion endpoint is not configured',
        ),
      );

      await expect(controller.suggest(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should propagate BadGatewayException when the external service fails', async () => {
      service.suggestSkill.mockRejectedValue(
        new BadGatewayException(
          'The skill suggestion could not be forwarded to the external service',
        ),
      );

      await expect(controller.suggest(dto)).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
