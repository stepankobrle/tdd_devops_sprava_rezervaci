import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './room.entity';
import { UserRole } from '../users/user.entity';

export interface CreateRoomDto {
  name: string;
  capacity: number;
}

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async createRoom(dto: CreateRoomDto, role: UserRole): Promise<Room> {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Pouze administrátor může vytvořit místnost.');
    }

    const room = this.roomRepository.create(dto);
    return this.roomRepository.save(room);
  }
}
