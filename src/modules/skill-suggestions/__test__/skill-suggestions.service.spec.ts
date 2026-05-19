import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { SuggestSkillDto } from '../dto/suggest-skill.dto';
import { SkillSuggestionsService } from '../skill-suggestions.service';

const ENDPOINT = 'https://external.example.com/suggestions';

describe('SkillSuggestionsService', () => {
  let service: SkillSuggestionsService;
  let httpService: { post: jest.Mock };
  let configService: { get: jest.Mock };

  const dto: SuggestSkillDto = {
    name: 'Electrician',
    description: 'Electrical wiring and repairs',
  };

  beforeEach(async () => {
    httpService = { post: jest.fn() };
    configService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillSuggestionsService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SkillSuggestionsService>(SkillSuggestionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('suggestSkill', () => {
    it('should forward the skill suggestion to the external endpoint', async () => {
      configService.get.mockReturnValue(ENDPOINT);
      httpService.post.mockReturnValue(of({ data: {} } as AxiosResponse));

      await expect(service.suggestSkill(dto)).resolves.toBeUndefined();

      expect(httpService.post).toHaveBeenCalledWith(ENDPOINT, {
        name: dto.name,
        description: dto.description,
      });
    });

    it('should throw InternalServerErrorException when the endpoint URL is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(service.suggestSkill(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should throw BadGatewayException when the external service returns an Axios error', async () => {
      configService.get.mockReturnValue(ENDPOINT);
      const axiosError = new AxiosError('Service Unavailable');
      (axiosError as AxiosError).response = { status: 503 } as AxiosResponse;
      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.suggestSkill(dto)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('should rethrow non-Axios errors as-is', async () => {
      configService.get.mockReturnValue(ENDPOINT);
      httpService.post.mockReturnValue(
        throwError(() => new Error('Unexpected internal error')),
      );

      await expect(service.suggestSkill(dto)).rejects.toThrow(
        'Unexpected internal error',
      );
    });
  });
});
