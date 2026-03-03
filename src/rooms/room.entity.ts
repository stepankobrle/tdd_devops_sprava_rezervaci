import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Reservation } from '../reservations/reservation.entity';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  capacity: number;

  @OneToMany(() => Reservation, (reservation) => reservation.room)
  reservations: Reservation[];
}
