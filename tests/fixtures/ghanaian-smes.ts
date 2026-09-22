// deterministic test-only fixtures; never used as startup seed data.

export const ghanaianSmes = [
  {
    name: 'Ama’s Boutique',
    company: 'Ama’s Boutique Ltd.',
    email: 'ama.boutique@example.test',
    phone: '024 111 2200',
    address: 'Osu, Accra',
    order: { description: '12 branded aprons for Friday delivery', status: 'PROCESSING' as const },
  },
  {
    name: 'Kofi Foods',
    company: 'Kofi Foods Co.',
    email: 'orders.kofi@example.test',
    phone: '020 333 4400',
    address: 'Asokwa, Kumasi',
    order: { description: 'Weekly pantry restock for the café', status: 'PENDING' as const },
  },
  {
    name: 'Northline Depot',
    company: 'Northline Depot GH',
    email: 'northline@example.test',
    phone: '055 555 6600',
    address: 'Spintex, Accra',
    order: { description: 'Restock delivery for the warehouse team', status: 'COMPLETED' as const },
  },
] as const;
