import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';

class CreateUserBody {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  createUser(@Body() body: CreateUserBody): Promise<User> {
    return this.usersService.createUser(body);
  }
}
