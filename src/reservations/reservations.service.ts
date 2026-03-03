import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { Reservation, ReservationStatus } from './reservation.entity';
import { Room } from '../rooms/room.entity';
import { User } from '../users/user.entity';

export interface CreateReservationDto {
  roomId: number;
  userId: number;
  startAt: Date;
  endAt: Date;
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async createReservation(dto: CreateReservationDto): Promise<Reservation> {
    
    const overlapping = await this.reservationRepository.find({
      where: {
        room: { id: dto.roomId },
        startAt: LessThan(dto.endAt),
        endAt: MoreThan(dto.startAt),
        status: Not(ReservationStatus.CANCELLED),
      },
    });

    if (overlapping.length > 0) {
      throw new ConflictException(
        'Místnost je v daném čase již rezervována.',
      );
    }

    const reservation = this.reservationRepository.create({
      room: { id: dto.roomId } as Room,
      user: { id: dto.userId } as User,
      startAt: dto.startAt,
      endAt: dto.endAt,
    });

    return this.reservationRepository.save(reservation);
  }

  calculatePrice(startAt: Date, endAt: Date, pricePerHour: number): number {
    if (endAt <= startAt) {
      throw new BadRequestException('Konec rezervace musí být po začátku.');
    }
    const hours = Math.ceil(
      (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60),
    );
    return hours * pricePerHour;
  }

  async cancelReservation(id: number): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({ where: { id } });

    if (!reservation) {
      throw new NotFoundException(`Rezervace ${id} neexistuje.`);
    }

    if (Date.now() > reservation.endAt.getTime()) {
      throw new BadRequestException(
        'Rezervaci nelze zrušit — již skončila.',
      );
    }

    reservation.status = ReservationStatus.CANCELLED;
    return this.reservationRepository.save(reservation);
  }
}
