import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

async function main() {
  const client = postgres(process.env.DATABASE_URL!);

  const [emp] = await client`SELECT COUNT(*) as count FROM employees`;
  const [proj] = await client`SELECT COUNT(*) as count FROM projects`;
  const [assign] = await client`SELECT COUNT(*) as count FROM assignments`;

  console.log('=== DATA DI SUPABASE ===');
  console.log('Employees:', emp[0].count);
  console.log('Projects:', proj[0].count);
  console.log('Assignments:', assign[0].count);

  await client.end();
}

main().catch(console.error);
