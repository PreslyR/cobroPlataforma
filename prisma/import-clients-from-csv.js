const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = {
    file: null,
    lenderId: null,
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--file') {
      args.file = argv[index + 1];
      index += 1;
    } else if (value === '--lender-id') {
      args.lenderId = argv[index + 1];
      index += 1;
    } else if (value === '--apply') {
      args.apply = true;
    }
  }

  return args;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function toTitleCase(value) {
  return normalizeWhitespace(value)
    .split(/(\s+|-)/)
    .map((segment) => {
      if (!segment || /^\s+$/.test(segment) || segment === '-') {
        return segment;
      }

      const normalized = segment.toLocaleLowerCase('es-CO');
      return (
        normalized.charAt(0).toLocaleUpperCase('es-CO') +
        normalized.slice(1)
      );
    })
    .join('');
}

function normalizePhone(value) {
  const digits = value.replace(/\D+/g, '');
  return digits || null;
}

function normalizeDocument(value) {
  return value.replace(/\D+/g, '').trim();
}

function normalizeEmail(value) {
  const cleaned = normalizeWhitespace(value).toLocaleLowerCase('es-CO');
  return cleaned || null;
}

function buildRows(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('El CSV no tiene filas de datos.');
  }

  const rows = [];

  for (const line of lines.slice(1)) {
    const columns = parseCsvLine(line);

    if (columns.length < 7) {
      throw new Error(`Fila invalida, se esperaban 7 columnas y llegaron ${columns.length}: ${line}`);
    }

    const [timestamp, firstNames, lastNames, address, phone, email, documentNumber] = columns;

    rows.push({
      timestamp: normalizeWhitespace(timestamp),
      firstNames: toTitleCase(firstNames),
      lastNames: toTitleCase(lastNames),
      fullName: toTitleCase(`${firstNames} ${lastNames}`),
      address: normalizeWhitespace(address) || null,
      phone: normalizePhone(phone),
      email: normalizeEmail(email),
      documentNumber: normalizeDocument(documentNumber),
      notes: `Origen: Google Forms | Captura: ${normalizeWhitespace(timestamp)}`,
    });
  }

  return rows;
}

function collectDuplicates(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.file || !args.lenderId) {
    throw new Error('Uso: node prisma/import-clients-from-csv.js --file <ruta> --lender-id <uuid> [--apply]');
  }

  const resolvedFile = path.resolve(args.file);
  const csvText = fs.readFileSync(resolvedFile, 'utf8');
  const rows = buildRows(csvText);

  const lender = await prisma.lender.findUnique({
    where: { id: args.lenderId },
    select: { id: true, name: true, isActive: true },
  });

  if (!lender) {
    throw new Error(`No existe lender con id ${args.lenderId}`);
  }

  const existingClients = await prisma.client.findMany({
    where: { lenderId: args.lenderId },
    select: {
      id: true,
      fullName: true,
      documentNumber: true,
      email: true,
      phone: true,
    },
  });

  const existingByDocument = new Map(existingClients.filter((item) => item.documentNumber).map((item) => [item.documentNumber, item]));
  const existingByEmail = new Map(existingClients.filter((item) => item.email).map((item) => [item.email, item]));
  const existingByPhone = new Map(existingClients.filter((item) => item.phone).map((item) => [item.phone, item]));

  const invalidRows = rows.filter((row) => !row.fullName || !row.documentNumber);
  const duplicateDocumentsInCsv = collectDuplicates(rows, 'documentNumber');
  const duplicateEmailsInCsv = collectDuplicates(rows, 'email');
  const duplicatePhonesInCsv = collectDuplicates(rows, 'phone');

  const collisionsWithDb = rows.flatMap((row) => {
    const collisions = [];
    if (row.documentNumber && existingByDocument.has(row.documentNumber)) {
      collisions.push({ type: 'documentNumber', value: row.documentNumber, existing: existingByDocument.get(row.documentNumber) });
    }
    if (row.email && existingByEmail.has(row.email)) {
      collisions.push({ type: 'email', value: row.email, existing: existingByEmail.get(row.email) });
    }
    if (row.phone && existingByPhone.has(row.phone)) {
      collisions.push({ type: 'phone', value: row.phone, existing: existingByPhone.get(row.phone) });
    }
    return collisions.length > 0 ? [{ row, collisions }] : [];
  });

  const report = {
    lender,
    file: resolvedFile,
    totalRows: rows.length,
    invalidRows: invalidRows.length,
    duplicateDocumentsInCsv,
    duplicateEmailsInCsv,
    duplicatePhonesInCsv,
    collisionsWithDbCount: collisionsWithDb.length,
    sample: rows.slice(0, 3),
  };

  console.log(JSON.stringify(report, null, 2));

  if (!args.apply) {
    return;
  }

  if (invalidRows.length > 0) {
    throw new Error('Hay filas invalidas. Corrige el CSV antes de importar.');
  }

  if (duplicateDocumentsInCsv.length > 0 || duplicateEmailsInCsv.length > 0 || duplicatePhonesInCsv.length > 0) {
    throw new Error('Hay duplicados dentro del CSV. Corrigelos antes de importar.');
  }

  if (collisionsWithDb.length > 0) {
    throw new Error('Hay colisiones con clientes existentes en la base.');
  }

  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.client.create({
        data: {
          lenderId: args.lenderId,
          fullName: row.fullName,
          documentNumber: row.documentNumber,
          email: row.email,
          phone: row.phone,
          address: row.address,
          notes: row.notes,
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          documentNumber: true,
          email: true,
          phone: true,
        },
      }),
    ),
  );

  console.log(JSON.stringify({ imported: created.length, clients: created.slice(0, 5) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
