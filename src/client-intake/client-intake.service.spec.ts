import { UnauthorizedException } from '@nestjs/common';
import { ClientIntakeStatus, ClientIntakeSource, UserRole } from '@prisma/client';
import { AuthenticatedAppUser } from '../auth/auth.types';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientIntakeService } from './client-intake.service';

describe('ClientIntakeService', () => {
  let service: ClientIntakeService;
  let prisma: {
    lender: { findFirst: jest.Mock };
    client: { findFirst: jest.Mock };
    clientIntakeSubmission: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let clientsService: {
    create: jest.Mock;
  };

  const authUser: AuthenticatedAppUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    lenderId: 'lender-1',
    lenderName: 'Francisco',
    supabaseUserId: 'supabase-1',
  };

  beforeEach(() => {
    prisma = {
      lender: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lender-1' }),
      },
      client: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      clientIntakeSubmission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    clientsService = {
      create: jest.fn(),
    };

    service = new ClientIntakeService(
      prisma as unknown as PrismaService,
      clientsService as unknown as ClientsService,
    );

    delete process.env.TALLY_WEBHOOK_SIGNING_SECRET;
  });

  afterEach(() => {
    delete process.env.TALLY_WEBHOOK_SIGNING_SECRET;
  });

  it('creates a normalized staging submission from a Tally webhook', async () => {
    prisma.clientIntakeSubmission.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'submission-1',
        ...data,
      }),
    );

    const payload = {
      eventId: 'event-1',
      eventType: 'FORM_RESPONSE',
      createdAt: '2026-04-17T18:00:00.000Z',
      data: {
        submissionId: 'sub-1',
        formId: 'form-1',
        formName: 'Clientes',
        fields: [
          { label: 'Ingresar Nombres', value: 'juan carlos' },
          { label: 'Ingresa apellidos', value: 'perez lopez' },
          { label: 'Ingresar su Cédula', value: '1.234.567.890' },
          { label: 'Número de celular', value: '+57 300-555-1212' },
          { label: 'Ingresar su Email', value: 'JUAN@MAIL.COM ' },
          { label: 'Ingresar dirección dónde reside', value: ' Calle 1 # 2 - 3 ' },
        ],
      },
    };

    const result = await service.receiveTallyWebhook('lender-1', payload);

    expect(prisma.clientIntakeSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lenderId: 'lender-1',
          source: ClientIntakeSource.TALLY,
          fullName: 'Juan Carlos Perez Lopez',
          documentNumber: '1234567890',
          phone: '573005551212',
          email: 'juan@mail.com',
          address: 'Calle 1 # 2 - 3',
          duplicateByDocument: false,
          duplicateByEmail: false,
          duplicateByPhone: false,
        }),
      }),
    );
    expect(result.id).toBe('submission-1');
  });

  it('returns the existing submission when the webhook event was already processed', async () => {
    prisma.clientIntakeSubmission.findUnique.mockResolvedValue({
      id: 'submission-existing',
      status: ClientIntakeStatus.PENDING,
    });

    const payload = {
      eventId: 'event-1',
      eventType: 'FORM_RESPONSE',
      data: {
        fields: [
          { label: 'Nombre completo', value: 'Juan Perez' },
          { label: 'Cédula', value: '1234567890' },
        ],
      },
    };

    const result = await service.receiveTallyWebhook('lender-1', payload);

    expect(result).toEqual({
      id: 'submission-existing',
      status: ClientIntakeStatus.PENDING,
    });
    expect(prisma.clientIntakeSubmission.create).not.toHaveBeenCalled();
  });

  it('rejects webhook payloads with invalid Tally signatures when a signing secret is configured', async () => {
    process.env.TALLY_WEBHOOK_SIGNING_SECRET = 'secret-key';

    const payload = {
      eventId: 'event-1',
      eventType: 'FORM_RESPONSE',
      data: {
        fields: [
          { label: 'Nombre completo', value: 'Juan Perez' },
          { label: 'Cédula', value: '1234567890' },
        ],
      },
    };

    await expect(
      service.receiveTallyWebhook('lender-1', payload, 'invalid-signature'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('approves a pending submission and creates the real client', async () => {
    prisma.clientIntakeSubmission.findFirst.mockResolvedValueOnce({
      id: 'submission-1',
      lenderId: 'lender-1',
      status: ClientIntakeStatus.PENDING,
      fullName: 'Juan Perez',
      documentNumber: '1234567890',
      email: 'juan@mail.com',
      phone: '3005551212',
      address: 'Calle 1',
      notes: 'Formulario',
    });
    clientsService.create.mockResolvedValue({
      id: 'client-1',
      fullName: 'Juan Perez',
      documentNumber: '1234567890',
    });
    prisma.clientIntakeSubmission.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'submission-1',
        ...data,
      }),
    );

    const result = await service.approveSubmission('submission-1', authUser, {});

    expect(clientsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        lenderId: 'lender-1',
        fullName: 'Juan Perez',
        documentNumber: '1234567890',
        email: 'juan@mail.com',
      }),
    );
    expect(prisma.clientIntakeSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'submission-1' },
        data: expect.objectContaining({
          status: ClientIntakeStatus.APPROVED,
          createdClient: { connect: { id: 'client-1' } },
          approvedBy: { connect: { id: 'admin-1' } },
        }),
      }),
    );
    expect(result.status).toBe(ClientIntakeStatus.APPROVED);
  });

  it('rejects a pending submission without creating a client', async () => {
    prisma.clientIntakeSubmission.findFirst.mockResolvedValueOnce({
      id: 'submission-1',
      lenderId: 'lender-1',
      status: ClientIntakeStatus.PENDING,
    });
    prisma.clientIntakeSubmission.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'submission-1',
        ...data,
      }),
    );

    const result = await service.rejectSubmission('submission-1', authUser, {
      reason: 'Registro duplicado',
    });

    expect(clientsService.create).not.toHaveBeenCalled();
    expect(prisma.clientIntakeSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'submission-1' },
        data: expect.objectContaining({
          status: ClientIntakeStatus.REJECTED,
          rejectionReason: 'Registro duplicado',
        }),
      }),
    );
    expect(result.status).toBe(ClientIntakeStatus.REJECTED);
  });
});
