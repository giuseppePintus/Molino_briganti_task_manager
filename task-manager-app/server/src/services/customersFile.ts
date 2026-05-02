import prisma from '../lib/prisma';

/**
 * Persistenza clienti su MariaDB tramite Prisma.
 * Mantiene la stessa firma del precedente modulo "customersFile" (basato su JSON),
 * ma tutte le funzioni sono ora async (DB).
 *
 * Le destinazioni multiple sono memorizzate nella tabella Destination (relazione 1:N).
 */

export class DuplicateNameError extends Error {
  constructor(name: string) {
    super(`Cliente con ragione sociale "${name}" già esistente`);
    this.name = 'DuplicateNameError';
  }
}

export interface Destination {
  id: number;
  label: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  cap?: string | null;
  phone?: string | null;
  notes?: string | null;
  openMorningStart?: string | null;
  openMorningEnd?: string | null;
  openAfternoonStart?: string | null;
  openAfternoonEnd?: string | null;
  deliveryMorningStart?: string | null;
  deliveryMorningEnd?: string | null;
  deliveryAfternoonStart?: string | null;
  deliveryAfternoonEnd?: string | null;
}

export interface Customer {
  id: number;
  code?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  cap?: string | null;
  phone?: string | null;
  email?: string | null;
  piva?: string | null;
  cf?: string | null;
  notes?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  deliveryStartTime?: string | null;
  deliveryEndTime?: string | null;
  destinations?: Destination[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

function mapDest(d: any): Destination {
  return {
    id: d.id,
    label: d.label,
    address: d.address,
    city: d.city,
    province: d.province,
    cap: d.cap,
    phone: d.phone,
    notes: d.notes,
    openMorningStart: d.openMorningStart,
    openMorningEnd: d.openMorningEnd,
    openAfternoonStart: d.openAfternoonStart,
    openAfternoonEnd: d.openAfternoonEnd,
    deliveryMorningStart: d.deliveryMorningStart,
    deliveryMorningEnd: d.deliveryMorningEnd,
    deliveryAfternoonStart: d.deliveryAfternoonStart,
    deliveryAfternoonEnd: d.deliveryAfternoonEnd
  };
}

function mapCustomer(c: any): Customer {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    address: c.address,
    city: c.city,
    province: c.province,
    cap: c.cap,
    phone: c.phone,
    email: c.email,
    piva: c.piva,
    cf: c.cf,
    notes: c.notes,
    openingTime: c.openingTime,
    closingTime: c.closingTime,
    deliveryStartTime: c.deliveryStartTime,
    deliveryEndTime: c.deliveryEndTime,
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    destinations: Array.isArray(c.destinations) ? c.destinations.map(mapDest) : []
  };
}

export async function loadCustomers(): Promise<Customer[]> {
  const rows = await prisma.customer.findMany({
    include: { destinations: true },
    orderBy: { name: 'asc' }
  });
  return rows.map(mapCustomer);
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    include: { destinations: true }
  });
  return c ? mapCustomer(c) : null;
}

async function findDuplicateByName(name: string, excludeId?: number): Promise<boolean> {
  const target = name.trim().toLowerCase();
  // Case-insensitive: usa filtro lato JS perché MariaDB già di default è case-insensitive
  // su utf8mb4_unicode_ci, ma per sicurezza confrontiamo qui.
  const candidates = await prisma.customer.findMany({
    where: excludeId !== undefined ? { id: { not: excludeId } } : {},
    select: { id: true, name: true }
  });
  return candidates.some(c => c.name.trim().toLowerCase() === target);
}

export async function addCustomer(
  customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Customer | null> {
  const dup = await findDuplicateByName(customer.name);
  if (dup) throw new DuplicateNameError(customer.name);

  const created = await prisma.customer.create({
    data: {
      code: customer.code ?? null,
      name: customer.name,
      address: customer.address ?? null,
      city: customer.city ?? null,
      province: customer.province ?? null,
      cap: customer.cap ?? null,
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      piva: customer.piva ?? null,
      cf: customer.cf ?? null,
      notes: customer.notes ?? null,
      openingTime: customer.openingTime ?? null,
      closingTime: customer.closingTime ?? null,
      deliveryStartTime: customer.deliveryStartTime ?? null,
      deliveryEndTime: customer.deliveryEndTime ?? null,
      isActive: customer.isActive !== false,
      destinations: customer.destinations && customer.destinations.length
        ? {
            create: customer.destinations.map(d => ({
              label: d.label,
              address: d.address ?? null,
              city: d.city ?? null,
              province: d.province ?? null,
              cap: d.cap ?? null,
              phone: d.phone ?? null,
              notes: d.notes ?? null,
              openMorningStart: d.openMorningStart ?? null,
              openMorningEnd: d.openMorningEnd ?? null,
              openAfternoonStart: d.openAfternoonStart ?? null,
              openAfternoonEnd: d.openAfternoonEnd ?? null,
              deliveryMorningStart: d.deliveryMorningStart ?? null,
              deliveryMorningEnd: d.deliveryMorningEnd ?? null,
              deliveryAfternoonStart: d.deliveryAfternoonStart ?? null,
              deliveryAfternoonEnd: d.deliveryAfternoonEnd ?? null
            }))
          }
        : undefined
    },
    include: { destinations: true }
  });
  return mapCustomer(created);
}

export async function updateCustomer(
  id: number,
  updates: Partial<Customer>
): Promise<Customer | null> {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return null;

  if (updates.name !== undefined) {
    const dup = await findDuplicateByName(updates.name, id);
    if (dup) throw new DuplicateNameError(updates.name);
  }

  const data: any = {};
  const fields: (keyof Customer)[] = [
    'code', 'name', 'address', 'city', 'province', 'cap', 'phone', 'email',
    'piva', 'cf', 'notes', 'openingTime', 'closingTime',
    'deliveryStartTime', 'deliveryEndTime', 'isActive'
  ];
  for (const f of fields) {
    if (updates[f] !== undefined) data[f] = updates[f] as any;
  }

  const updated = await prisma.customer.update({
    where: { id },
    data,
    include: { destinations: true }
  });
  return mapCustomer(updated);
}

export async function deleteCustomer(id: number): Promise<boolean> {
  try {
    await prisma.customer.delete({ where: { id } });
    return true;
  } catch (e) {
    return false;
  }
}

export async function searchCustomers(query: string, activeOnly: boolean = false): Promise<Customer[]> {
  const search = query.trim();
  const rows = await prisma.customer.findMany({
    where: {
      AND: [
        activeOnly ? { isActive: true } : {},
        {
          OR: [
            { name: { contains: search } },
            { code: { contains: search } },
            { city: { contains: search } },
            { email: { contains: search } }
          ]
        }
      ]
    },
    include: { destinations: true },
    orderBy: { name: 'asc' }
  });
  return rows.map(mapCustomer);
}

export async function exportAsCSV(): Promise<string> {
  const customers = await loadCustomers();
  const headers = [
    'id', 'code', 'name', 'address', 'city', 'province', 'cap',
    'phone', 'email', 'piva', 'cf', 'notes', 'openingTime',
    'closingTime', 'deliveryStartTime', 'deliveryEndTime', 'isActive'
  ];
  const rows = customers.map(c => [
    c.id,
    c.code || '',
    c.name,
    c.address || '',
    c.city || '',
    c.province || '',
    c.cap || '',
    c.phone || '',
    c.email || '',
    c.piva || '',
    c.cf || '',
    c.notes || '',
    c.openingTime || '',
    c.closingTime || '',
    c.deliveryStartTime || '',
    c.deliveryEndTime || '',
    c.isActive ? 'true' : 'false'
  ]);
  return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
}

export async function importCustomers(
  newCustomers: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<number> {
  let added = 0;
  for (const c of newCustomers) {
    try {
      const dup = await findDuplicateByName(c.name);
      if (dup) continue;
      await addCustomer(c);
      added++;
    } catch (_e) { /* skip */ }
  }
  return added;
}

// ============================================================
// DESTINAZIONI
// ============================================================

export async function getDestinations(customerId: number): Promise<Destination[]> {
  const rows = await prisma.destination.findMany({
    where: { customerId },
    orderBy: { id: 'asc' }
  });
  return rows.map(mapDest);
}

export async function addDestination(
  customerId: number,
  dest: Omit<Destination, 'id'>
): Promise<Destination | null> {
  const cust = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!cust) return null;
  const created = await prisma.destination.create({
    data: {
      customerId,
      label: dest.label,
      address: dest.address ?? null,
      city: dest.city ?? null,
      province: dest.province ?? null,
      cap: dest.cap ?? null,
      phone: dest.phone ?? null,
      notes: dest.notes ?? null,
      openMorningStart: dest.openMorningStart ?? null,
      openMorningEnd: dest.openMorningEnd ?? null,
      openAfternoonStart: dest.openAfternoonStart ?? null,
      openAfternoonEnd: dest.openAfternoonEnd ?? null,
      deliveryMorningStart: dest.deliveryMorningStart ?? null,
      deliveryMorningEnd: dest.deliveryMorningEnd ?? null,
      deliveryAfternoonStart: dest.deliveryAfternoonStart ?? null,
      deliveryAfternoonEnd: dest.deliveryAfternoonEnd ?? null
    }
  });
  return mapDest(created);
}

export async function updateDestination(
  customerId: number,
  destId: number,
  updates: Partial<Destination>
): Promise<Destination | null> {
  const existing = await prisma.destination.findFirst({
    where: { id: destId, customerId }
  });
  if (!existing) return null;

  const data: any = {};
  const fields: (keyof Destination)[] = [
    'label', 'address', 'city', 'province', 'cap', 'phone', 'notes',
    'openMorningStart', 'openMorningEnd', 'openAfternoonStart', 'openAfternoonEnd',
    'deliveryMorningStart', 'deliveryMorningEnd', 'deliveryAfternoonStart', 'deliveryAfternoonEnd'
  ];
  for (const f of fields) {
    if (updates[f] !== undefined) data[f] = updates[f] as any;
  }
  const updated = await prisma.destination.update({
    where: { id: destId },
    data
  });
  return mapDest(updated);
}

export async function deleteDestination(customerId: number, destId: number): Promise<boolean> {
  const existing = await prisma.destination.findFirst({
    where: { id: destId, customerId }
  });
  if (!existing) return false;
  await prisma.destination.delete({ where: { id: destId } });
  return true;
}
