import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ClientIntakeSource,
  ClientIntakeStatus,
  Prisma,
} from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthenticatedAppUser } from '../auth/auth.types';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveClientIntakeDto } from './dto/approve-client-intake.dto';
import { ListClientIntakeSubmissionsDto } from './dto/list-client-intake-submissions.dto';
import { RejectClientIntakeDto } from './dto/reject-client-intake.dto';

type TallyWebhookField = {
  key?: string;
  label?: string;
  type?: string;
  value?: unknown;
};

type TallyWebhookPayload = {
  eventId?: string;
  eventType?: string;
  createdAt?: string;
  data?: {
    responseId?: string;
    submissionId?: string;
    formId?: string;
    formName?: string;
    createdAt?: string;
    fields?: TallyWebhookField[];
  };
};

type NormalizedClientIntake = {
  fullName: string;
  documentNumber: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

@Injectable()
export class ClientIntakeService {
  private readonly logger = new Logger(ClientIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  async receiveTallyWebhook(
    lenderId: string,
    payload: unknown,
    signature?: string,
  ) {
    await this.assertActiveLender(lenderId);
    const tallyPayload = this.assertTallyPayload(payload);

    if (tallyPayload.eventType !== 'FORM_RESPONSE') {
      throw new BadRequestException('Unsupported Tally event type.');
    }

    this.assertValidSignature(tallyPayload, signature);

    if (tallyPayload.eventId) {
      const existing = await this.prisma.clientIntakeSubmission.findUnique({
        where: { sourceEventId: tallyPayload.eventId },
        include: this.submissionInclude,
      });

      if (existing) {
        return existing;
      }
    }

    const normalized = this.normalizeTallyPayload(tallyPayload);
    const duplicateFlags = await this.computeDuplicateFlags(
      lenderId,
      normalized,
    );

    return this.prisma.clientIntakeSubmission.create({
      data: {
        lenderId,
        source: ClientIntakeSource.TALLY,
        sourceEventId: tallyPayload.eventId,
        sourceSubmissionId:
          tallyPayload.data?.submissionId ?? tallyPayload.data?.responseId,
        sourceFormId: tallyPayload.data?.formId,
        sourceFormName: tallyPayload.data?.formName,
        submittedAt: this.parseSubmissionDate(tallyPayload),
        fullName: normalized.fullName,
        documentNumber: normalized.documentNumber,
        email: normalized.email,
        phone: normalized.phone,
        address: normalized.address,
        notes: normalized.notes,
        rawPayload: tallyPayload as Prisma.InputJsonValue,
        ...duplicateFlags,
      },
      include: this.submissionInclude,
    });
  }

  async listSubmissions(
    lenderId: string,
    query: ListClientIntakeSubmissionsDto,
  ) {
    return this.prisma.clientIntakeSubmission.findMany({
      where: {
        lenderId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 50,
      include: this.submissionInclude,
    });
  }

  async approveSubmission(
    id: string,
    authUser: AuthenticatedAppUser,
    dto: ApproveClientIntakeDto,
  ) {
    const submission = await this.getPendingSubmission(id, authUser.lenderId);

    const normalized = this.normalizeApprovedClient({
      fullName: dto.fullName ?? submission.fullName,
      documentNumber: dto.documentNumber ?? submission.documentNumber,
      email: dto.email ?? submission.email ?? undefined,
      phone: dto.phone ?? submission.phone ?? undefined,
      address: dto.address ?? submission.address ?? undefined,
      notes: dto.notes ?? submission.notes ?? undefined,
    });

    await this.assertNoClientConflicts(authUser.lenderId, normalized);

    const createdClient = await this.clientsService.create({
      lenderId: authUser.lenderId,
      fullName: normalized.fullName,
      documentNumber: normalized.documentNumber,
      email: normalized.email,
      phone: normalized.phone,
      address: normalized.address,
      notes: normalized.notes,
      isActive: true,
    });

    return this.prisma.clientIntakeSubmission.update({
      where: { id: submission.id },
      data: {
        status: ClientIntakeStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: { connect: { id: authUser.id } },
        createdClient: { connect: { id: createdClient.id } },
        rejectionReason: null,
      },
      include: this.submissionInclude,
    });
  }

  async rejectSubmission(
    id: string,
    authUser: AuthenticatedAppUser,
    dto: RejectClientIntakeDto,
  ) {
    const submission = await this.getPendingSubmission(id, authUser.lenderId);

    return this.prisma.clientIntakeSubmission.update({
      where: { id: submission.id },
      data: {
        status: ClientIntakeStatus.REJECTED,
        rejectionReason: this.cleanOptionalValue(dto.reason) ?? 'Rejected by admin.',
      },
      include: this.submissionInclude,
    });
  }

  private get submissionInclude() {
    return {
      lender: {
        select: {
          id: true,
          name: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
        },
      },
      createdClient: {
        select: {
          id: true,
          fullName: true,
          documentNumber: true,
          email: true,
          phone: true,
        },
      },
    } satisfies Prisma.ClientIntakeSubmissionInclude;
  }

  private async getPendingSubmission(id: string, lenderId: string) {
    const submission = await this.prisma.clientIntakeSubmission.findFirst({
      where: {
        id,
        lenderId,
      },
    });

    if (!submission) {
      throw new NotFoundException('Client intake submission not found.');
    }

    if (submission.status !== ClientIntakeStatus.PENDING) {
      throw new BadRequestException(
        'Only pending intake submissions can be processed.',
      );
    }

    return submission;
  }

  private async assertActiveLender(lenderId: string) {
    const lender = await this.prisma.lender.findFirst({
      where: {
        id: lenderId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!lender) {
      throw new NotFoundException('Active lender not found for client intake.');
    }
  }

  private assertTallyPayload(payload: unknown): TallyWebhookPayload {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid Tally payload.');
    }

    return payload as TallyWebhookPayload;
  }

  private assertValidSignature(
    payload: TallyWebhookPayload,
    signature?: string,
  ) {
    const signingSecret = process.env.TALLY_WEBHOOK_SIGNING_SECRET?.trim();

    if (!signingSecret) {
      return;
    }

    if (!signature) {
      throw new UnauthorizedException('Missing Tally signature header.');
    }

    const expected = createHmac('sha256', signingSecret)
      .update(JSON.stringify(payload))
      .digest('base64');

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Tally signature.');
    }
  }

  private normalizeTallyPayload(payload: TallyWebhookPayload): NormalizedClientIntake {
    const fields = Array.isArray(payload.data?.fields) ? payload.data.fields : [];

    const providedFullName = this.findFieldValue(fields, [
      'nombre completo',
      'full name',
      'cliente',
    ]);
    const names = this.findFieldValue(fields, [
      'nombres',
      'nombre',
      'ingresar nombres',
    ]);
    const lastNames = this.findFieldValue(fields, [
      'apellidos',
      'apellido',
      'ingresa apellidos',
    ]);
    const documentNumber = this.findFieldValue(fields, [
      'cedula',
      'cédula',
      'numero de cedula',
      'numero de cédula',
      'documento',
      'numero de documento',
      'ingresar su cedula',
      'ingresar su cédula',
    ]);
    const email = this.findFieldValue(fields, [
      'email',
      'correo',
      'correo electronico',
      'correo electrónico',
      'ingresar su email',
    ]);
    const phone = this.findFieldValue(fields, [
      'numero de celular',
      'número de celular',
      'celular',
      'telefono',
      'teléfono',
      'phone number',
    ]);
    const address = this.findFieldValue(fields, [
      'direccion',
      'dirección',
      'direccion donde reside',
      'dirección dónde reside',
      'direccion de residencia',
      'dirección de residencia',
    ]);
    const notes = this.findFieldValue(fields, [
      'notas',
      'observaciones',
      'comentarios',
    ]);

    const fullName = this.normalizeName(
      providedFullName ?? [names, lastNames].filter(Boolean).join(' '),
    );
    const normalizedDocument = this.normalizeDocumentNumber(documentNumber);

    if (!fullName) {
      throw new BadRequestException(
        'Client intake submission is missing a valid full name.',
      );
    }

    if (!normalizedDocument) {
      throw new BadRequestException(
        'Client intake submission is missing a valid document number.',
      );
    }

    return {
      fullName,
      documentNumber: normalizedDocument,
      email: this.normalizeEmail(email),
      phone: this.normalizePhone(phone),
      address: this.cleanOptionalValue(address),
      notes: this.cleanOptionalValue(notes),
    };
  }

  private normalizeApprovedClient(
    input: NormalizedClientIntake,
  ): NormalizedClientIntake {
    const normalized = {
      fullName: this.normalizeName(input.fullName),
      documentNumber: this.normalizeDocumentNumber(input.documentNumber),
      email: this.normalizeEmail(input.email),
      phone: this.normalizePhone(input.phone),
      address: this.cleanOptionalValue(input.address),
      notes: this.cleanOptionalValue(input.notes),
    };

    if (!normalized.fullName) {
      throw new BadRequestException('fullName is required to approve intake.');
    }

    if (!normalized.documentNumber) {
      throw new BadRequestException(
        'documentNumber is required to approve intake.',
      );
    }

    return normalized;
  }

  private async computeDuplicateFlags(
    lenderId: string,
    input: NormalizedClientIntake,
  ) {
    const [duplicateByDocument, duplicateByEmail, duplicateByPhone] =
      await Promise.all([
        this.prisma.client.findFirst({
          where: {
            lenderId,
            documentNumber: input.documentNumber,
          },
          select: { id: true },
        }),
        input.email
          ? this.prisma.client.findFirst({
              where: {
                lenderId,
                email: input.email,
              },
              select: { id: true },
            })
          : Promise.resolve(null),
        input.phone
          ? this.prisma.client.findFirst({
              where: {
                lenderId,
                phone: input.phone,
              },
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

    return {
      duplicateByDocument: Boolean(duplicateByDocument),
      duplicateByEmail: Boolean(duplicateByEmail),
      duplicateByPhone: Boolean(duplicateByPhone),
    };
  }

  private async assertNoClientConflicts(
    lenderId: string,
    input: NormalizedClientIntake,
  ) {
    const [documentMatch, emailMatch, phoneMatch] = await Promise.all([
      this.prisma.client.findFirst({
        where: {
          lenderId,
          documentNumber: input.documentNumber,
        },
        select: {
          id: true,
          fullName: true,
        },
      }),
      input.email
        ? this.prisma.client.findFirst({
            where: {
              lenderId,
              email: input.email,
            },
            select: {
              id: true,
              fullName: true,
            },
          })
        : Promise.resolve(null),
      input.phone
        ? this.prisma.client.findFirst({
            where: {
              lenderId,
              phone: input.phone,
            },
            select: {
              id: true,
              fullName: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (documentMatch) {
      throw new ConflictException(
        `A client with document ${input.documentNumber} already exists (${documentMatch.fullName}).`,
      );
    }

    if (emailMatch) {
      throw new ConflictException(
        `A client with email ${input.email} already exists (${emailMatch.fullName}).`,
      );
    }

    if (phoneMatch) {
      throw new ConflictException(
        `A client with phone ${input.phone} already exists (${phoneMatch.fullName}).`,
      );
    }
  }

  private parseSubmissionDate(payload: TallyWebhookPayload) {
    const rawDate =
      payload.data?.createdAt ?? payload.createdAt ?? new Date().toISOString();
    const parsed = new Date(rawDate);

    if (Number.isNaN(parsed.getTime())) {
      this.logger.warn(
        `Invalid Tally submission date "${rawDate}", using current timestamp instead.`,
      );
      return new Date();
    }

    return parsed;
  }

  private findFieldValue(fields: TallyWebhookField[], aliases: string[]) {
    const normalizedAliases = aliases.map((alias) =>
      this.normalizeFieldLabel(alias),
    );
    const match = fields.find((field) => {
      const normalizedLabel = this.normalizeFieldLabel(field.label);
      const normalizedKey = this.normalizeFieldLabel(field.key);
      return normalizedAliases.some(
        (alias) =>
          normalizedLabel === alias ||
          (normalizedKey.length > 0 && normalizedKey === alias) ||
          normalizedLabel.includes(alias) ||
          (normalizedKey.length > 0 && normalizedKey.includes(alias)) ||
          (normalizedLabel.length > 0 && alias.includes(normalizedLabel)) ||
          (normalizedKey.length > 0 && alias.includes(normalizedKey)),
      );
    });

    if (!match) {
      return undefined;
    }

    if (match.value == null) {
      return undefined;
    }

    if (typeof match.value === 'string' || typeof match.value === 'number') {
      return String(match.value);
    }

    return undefined;
  }

  private normalizeFieldLabel(value?: string) {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private normalizeName(value?: string) {
    const cleaned = this.cleanOptionalValue(value);

    if (!cleaned) {
      return undefined;
    }

    return cleaned
      .split(/\s+/)
      .map((segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
      )
      .join(' ');
  }

  private normalizeDocumentNumber(value?: string) {
    const digits = (value ?? '').replace(/\D+/g, '');
    return digits || undefined;
  }

  private normalizePhone(value?: string) {
    const digits = (value ?? '').replace(/\D+/g, '');
    return digits || undefined;
  }

  private normalizeEmail(value?: string) {
    const cleaned = this.cleanOptionalValue(value)?.toLowerCase();
    return cleaned || undefined;
  }

  private cleanOptionalValue(value?: string) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : undefined;
  }
}
