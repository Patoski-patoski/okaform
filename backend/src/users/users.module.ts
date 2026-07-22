import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from '../common/schemas/user.schema';
import {
  SurveyResponse,
  ResponseSchema,
} from '../common/schemas/response.schema';
import { DistributionModule } from '../distribution/distribution.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: SurveyResponse.name, schema: ResponseSchema },
    ]),
    DistributionModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
