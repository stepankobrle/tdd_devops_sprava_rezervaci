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

  createRoom(_dto: CreateRoomDto, _role: UserRole): Promise<Room> {
    return Promise.reject(new Error('Not implemented'));
  }
}
