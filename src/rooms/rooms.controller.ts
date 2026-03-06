import { Body, Controller, Headers, Post } from '@nestjs/common';
import { IsNumber, IsString, Min } from 'class-validator';
import { RoomsService } from './rooms.service';
import { Room } from './room.entity';
import { UserRole } from '../users/user.entity';

class CreateRoomBody {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  capacity: number;
}

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  createRoom(
    @Body() body: CreateRoomBody,
    @Headers('x-user-role') role: UserRole,
  ): Promise<Room> {
    return this.roomsService.createRoom(body, role);
  }
}
