import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  UsePipes,
  BadRequestException,
  ValidationPipe,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JoiValidationPipe } from 'src/middleware/joi-validation.middleware';
import { createUserSchema } from 'src/middleware/createUserSchema';
import { hashPassword } from 'src/utils/encryption';
import { updateUserSchema } from 'src/middleware/updateUserSchema';

const MongoErrorDuplicateKeyErrorCode = 11000;

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UsePipes(new JoiValidationPipe(createUserSchema))
  async create(@Body() createUserDto: CreateUserDto) {
    const hashedPassword = await hashPassword(createUserDto.password);

    const userToDb: CreateUserDto = {
      ...createUserDto,
      password: hashedPassword,
    };
    try {
      const result = await this.usersService.create(userToDb);
      if (result.password) {
        const { password, ...userWithoutPassword } = result;
        return userWithoutPassword;
      } else return result;
    } catch (error) {
      let errorMessage;
      if (
        error?.name === 'MongoError' &&
        error?.code == MongoErrorDuplicateKeyErrorCode
      ) {
        errorMessage = 'User with this email is already registered.';
      }
      throw new BadRequestException(errorMessage || error.message);
    }
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // validation is here as for some reasons UsePipes does not work
    const { error } = updateUserSchema.validate(updateUserDto, {
      errors: {
        wrap: {
          label: '',
        },
      },
    });
    if (error) {
      throw new BadRequestException(error.message);
    } else {
      const userFromDb = await this.usersService.findOneById(+id);
      if (!userFromDb) {
        throw new BadRequestException('User not found!');
      } else {
        //
        const dataToUpdate = {
          ...JSON.parse(JSON.stringify(userFromDb)),
          ...updateUserDto,
        };
        return this.usersService.update(+id, dataToUpdate);
      }
    }
  }
}
