import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { Public } from '../auth/public.decorator';
import { AuthenticatedAppUser } from '../auth/auth.types';
import { ApproveClientIntakeDto } from './dto/approve-client-intake.dto';
import { ListClientIntakeSubmissionsDto } from './dto/list-client-intake-submissions.dto';
import { RejectClientIntakeDto } from './dto/reject-client-intake.dto';
import { ClientIntakeService } from './client-intake.service';

@Controller('client-intake')
export class ClientIntakeController {
  constructor(private readonly clientIntakeService: ClientIntakeService) {}

  @Public()
  @Post('tally/:lenderId')
  receiveTallyWebhook(
    @Param('lenderId') lenderId: string,
    @Body() payload: unknown,
    @Headers('tally-signature') tallySignature?: string,
  ) {
    return this.clientIntakeService.receiveTallyWebhook(
      lenderId,
      payload,
      tallySignature,
    );
  }

  @Get('submissions')
  listSubmissions(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query() query: ListClientIntakeSubmissionsDto,
  ) {
    return this.clientIntakeService.listSubmissions(authUser.lenderId, query);
  }

  @Post('submissions/:id/approve')
  approveSubmission(
    @Param('id') id: string,
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Body() dto: ApproveClientIntakeDto,
  ) {
    return this.clientIntakeService.approveSubmission(id, authUser, dto);
  }

  @Post('submissions/:id/reject')
  rejectSubmission(
    @Param('id') id: string,
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Body() dto: RejectClientIntakeDto,
  ) {
    return this.clientIntakeService.rejectSubmission(id, authUser, dto);
  }
}
