import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { Room } from './room.entity';
import { UserRole } from '../users/user.entity';

const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

type MockRepository = ReturnType<typeof createMockRepository>;

describe('RoomsService', () => {
  let service: RoomsService;
  let roomRepository: MockRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: getRepositoryToken(Room),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    roomRepository = module.get(getRepositoryToken(Room));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // 3.: Omezení rolí
  // Pouze ADMIN může vytvořit novou místnost.
  // Běžný USER dostane ForbiddenException (HTTP 403).
  // =========================================================
  describe('createRoom', () => {
    it(' ForbiddenException kdyz role je USER', async () => {
      await expect(
        service.createRoom({ name: 'Zasedačka A', capacity: 10 }, UserRole.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('kdyz role je ADMIN', async () => {
      const savedRoom: Partial<Room> = { id: 1, name: 'Zasedačka A', capacity: 10 };
      roomRepository.create.mockReturnValue(savedRoom);
      roomRepository.save.mockResolvedValue(savedRoom);

      const result = await service.createRoom(
        { name: 'Zasedačka A', capacity: 10 },
        UserRole.ADMIN,
      );

      expect(roomRepository.save).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 1, name: 'Zasedačka A' });
    });
  });
});
