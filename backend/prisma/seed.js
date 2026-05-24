const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Crear usuarios de prueba
  const adminPass = await bcrypt.hash('Admin123!', 10);
  const staffPass = await bcrypt.hash('Staff123!', 10);
  const clientPass = await bcrypt.hash('Client123!', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@vuelos.com' },
    update: {},
    create: { nombre: 'Admin Sistema', email: 'admin@vuelos.com', password: adminPass, role: 'ADMIN' },
  });

  const staff = await prisma.usuario.upsert({
    where: { email: 'staff@vuelos.com' },
    update: {},
    create: { nombre: 'Staff Operaciones', email: 'staff@vuelos.com', password: staffPass, role: 'STAFF' },
  });

  const client = await prisma.usuario.upsert({
    where: { email: 'cliente@vuelos.com' },
    update: {},
    create: { nombre: 'Juan Cliente', email: 'cliente@vuelos.com', password: clientPass, role: 'CLIENT' },
  });

  // Crear vuelos de prueba
  const ahora = new Date();
  const vuelosData = [
    { origen: 'Ciudad de México', destino: 'Guadalajara', fechaSalida: new Date(ahora.getTime() + 2 * 24 * 60 * 60 * 1000), precio: 1200, asientosDisponibles: 50 },
    { origen: 'Ciudad de México', destino: 'Monterrey', fechaSalida: new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000), precio: 1500, asientosDisponibles: 30 },
    { origen: 'Guadalajara', destino: 'Cancún', fechaSalida: new Date(ahora.getTime() + 5 * 24 * 60 * 60 * 1000), precio: 3200, asientosDisponibles: 20 },
    { origen: 'Monterrey', destino: 'Tijuana', fechaSalida: new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000), precio: 2800, asientosDisponibles: 15 },
    { origen: 'Ciudad de México', destino: 'Cancún', fechaSalida: new Date(ahora.getTime() + 10 * 24 * 60 * 60 * 1000), precio: 3500, asientosDisponibles: 60 },
    { origen: 'Guadalajara', destino: 'Ciudad de México', fechaSalida: new Date(ahora.getTime() + 1 * 24 * 60 * 60 * 1000), precio: 1100, asientosDisponibles: 45 },
  ];

  for (const vuelo of vuelosData) {
    await prisma.vuelo.create({ data: vuelo });
  }

  console.log('✅ Seed completado');
  console.log('👤 admin@vuelos.com / Admin123!');
  console.log('👤 staff@vuelos.com / Staff123!');
  console.log('👤 cliente@vuelos.com / Client123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
