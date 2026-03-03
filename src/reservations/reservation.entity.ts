import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Room } from '../rooms/room.entity';
import { User } from '../users/user.entity';

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity()
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Room, (room) => room.reservations, { nullable: false })
  room: Room;

  @ManyToOne(() => User, (user) => user.reservations, { nullable: false })
  user: User;

  @Column()
  startAt: Date;

  @Column()
  endAt: Date;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;
}
