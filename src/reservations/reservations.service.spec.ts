import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { Reservation, ReservationStatus } from './reservation.entity';
import { BadRequestException, ConflictException } from '@nestjs/common';

// Tento pattern je bezpečnější pro TypeScript + ESLint:
// ReturnType<typeof createMockRepository> odvodí typ přímo z funkce,
// takže TypeScript ví přesně že find, save, create jsou jest.Mock funkce.
const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

type MockRepository = ReturnType<typeof createMockRepository>;

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
  // 1.Kolize časů
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

      reservationRepository.find.mockResolvedValue([existingReservation]);

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
      reservationRepository.find.mockResolvedValue([]);

      const savedReservation: Partial<Reservation> = {
        id: 42,
        startAt: new Date('2025-06-01T10:00:00'),
        endAt: new Date('2025-06-01T12:00:00'),
        status: ReservationStatus.PENDING,
      };

      reservationRepository.create.mockReturnValue(savedReservation);
      reservationRepository.save.mockResolvedValue(savedReservation);

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


  // =========================================================
  // 2. Stavový přechod — zrušení po skončení
  // Rezervaci nelze zrušit pokud již skončila (endAt je v minulosti).
  // Mockujeme čas pomocí jest.spyOn(Date, 'now') — externí závislost.
  // =========================================================
  describe('cancelReservation', () => {
    it('should throw BadRequestException when reservation has already ended', async () => {
      const pastReservation: Partial<Reservation> = {
        id: 1,
        startAt: new Date('2025-01-01T10:00:00'),
        endAt: new Date('2025-01-01T12:00:00'),
        status: ReservationStatus.CONFIRMED,
      };
      reservationRepository.findOne.mockResolvedValue(pastReservation);

      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2025-01-01T13:00:00').getTime(),
      );

      await expect(service.cancelReservation(1)).rejects.toThrow(
        BadRequestException,
      );

      jest.restoreAllMocks();
    });

    it('should cancel reservation when it has not ended yet', async () => {
      const activeReservation: Partial<Reservation> = {
        id: 1,
        startAt: new Date('2025-06-01T10:00:00'),
        endAt: new Date('2025-06-01T12:00:00'),
        status: ReservationStatus.CONFIRMED,
      };
      reservationRepository.findOne.mockResolvedValue(activeReservation);

      const cancelled = { ...activeReservation, status: ReservationStatus.CANCELLED };
      reservationRepository.save.mockResolvedValue(cancelled);

      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2025-06-01T11:00:00').getTime(),
      );

      const result = await service.cancelReservation(1);

      expect(result.status).toBe(ReservationStatus.CANCELLED);
      expect(reservationRepository.save).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });



  // =========================================================
  // 4. Výpočet ceny rezervace
  // Cena = počet hodin × cena za hodinu místnosti.
  // Čistá funkce — žádná DB, žádný async.
  // =========================================================
  describe('calculatePrice', () => {
    it('should return correct price for 2 hour reservation at 100 per hour', () => {
      const startAt = new Date('2025-06-01T10:00:00');
      const endAt = new Date('2025-06-01T12:00:00');

      const price = service.calculatePrice(startAt, endAt, 100);

      expect(price).toBe(200);
    });

    it('should return correct price for 1.5 hour reservation (rounded up to 2 hours)', () => {
      const startAt = new Date('2025-06-01T10:00:00');
      const endAt = new Date('2025-06-01T11:30:00');

      const price = service.calculatePrice(startAt, endAt, 100);

      expect(price).toBe(200);
    });

    it('should throw BadRequestException when endAt is before startAt', () => {
      const startAt = new Date('2025-06-01T12:00:00');
      const endAt = new Date('2025-06-01T10:00:00');

      expect(() => service.calculatePrice(startAt, endAt, 100)).toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================
  // 5. Idempotence — zrušenou rezervaci nelze znovu zrušit
  // Pokud je rezervace již ve stavu CANCELLED, další pokus
  // o zrušení musí vyhodit BadRequestException.
  // Testuje správnost stavového automatu.
  // =========================================================
  describe('cancelReservation - idempotence', () => {
    it('should throw BadRequestException when reservation is already cancelled', async () => {
      const cancelledReservation: Partial<Reservation> = {
        id: 1,
        startAt: new Date('2025-06-01T10:00:00'),
        endAt: new Date('2025-06-01T12:00:00'),
        status: ReservationStatus.CANCELLED,
      };
      reservationRepository.findOne.mockResolvedValue(cancelledReservation);

     
      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2025-06-01T09:00:00').getTime(),
      );

      await expect(service.cancelReservation(1)).rejects.toThrow(
        BadRequestException,
      );

      jest.restoreAllMocks();
    });
  });
});
