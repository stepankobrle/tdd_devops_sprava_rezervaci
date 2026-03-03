import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservationsService } from './reservations.service';
import { Reservation, ReservationStatus } from './reservation.entity';
import { ConflictException } from '@nestjs/common';


type MockRepository = Partial<Record<keyof Repository<Reservation>, jest.Mock>>;

const createMockRepository = (): MockRepository => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepository: MockRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          
          provide: getRepositoryToken(Reservation),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    reservationRepository = module.get(getRepositoryToken(Reservation));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================
  // BUSINESS PRAVIDLO 1: Kolize časů
  // Pokud je místnost v daném časovém úseku již rezervována,
  // nelze vytvořit novou rezervaci — musí být vyhozena výjimka.
  // =========================================================
  describe('createReservation', () => {
    it('should throw ConflictException when room is already reserved in that time slot', async () => {
     
      const existingReservation: Partial<Reservation> = {
        id: 1,
        startAt: new Date('2025-06-01T10:00:00'),
        endAt: new Date('2025-06-01T12:00:00'),
        status: ReservationStatus.CONFIRMED,
      };
      reservationRepository.find!.mockResolvedValue([existingReservation]);
      await expect(
        service.createReservation({
          roomId: 1,
          userId: 1,
          startAt: new Date('2025-06-01T11:00:00'),
          endAt: new Date('2025-06-01T13:00:00'),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create reservation when room is free in that time slot', async () => {
      reservationRepository.find!.mockResolvedValue([]);

      const savedReservation: Partial<Reservation> = {
        id: 42,
        startAt: new Date('2025-06-01T10:00:00'),
        endAt: new Date('2025-06-01T12:00:00'),
        status: ReservationStatus.PENDING,
      };

      reservationRepository.create!.mockReturnValue(savedReservation);
      reservationRepository.save!.mockResolvedValue(savedReservation);

      const result = await service.createReservation({
        roomId: 1,
        userId: 1,
        startAt: new Date('2025-06-01T10:00:00'),
        endAt: new Date('2025-06-01T12:00:00'),
      });

      expect(reservationRepository.save).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 42 });
    });
  });
});
