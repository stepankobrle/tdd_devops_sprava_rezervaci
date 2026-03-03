import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './reservation.entity';

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

  createReservation(_dto: CreateReservationDto): Promise<Reservation> {
    return Promise.reject(new Error('Not implemented'));
  }
}
