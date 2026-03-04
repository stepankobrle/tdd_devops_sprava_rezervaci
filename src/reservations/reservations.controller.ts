import { Body, Controller, Delete, Param, ParseIntPipe, Post } from '@nestjs/common';
import { IsDateString, IsNumber } from 'class-validator';
import { ReservationsService } from './reservations.service';
import { Reservation } from './reservation.entity';

class CreateReservationBody {
  @IsNumber()
  roomId: number;

  @IsNumber()
  userId: number;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;
}

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  createReservation(@Body() body: CreateReservationBody): Promise<Reservation> {
    return this.reservationsService.createReservation({
      roomId: body.roomId,
      userId: body.userId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
    });
  }

  @Delete(':id')
  cancelReservation(@Param('id', ParseIntPipe) id: number): Promise<Reservation> {
    return this.reservationsService.cancelReservation(id);
  }
}
