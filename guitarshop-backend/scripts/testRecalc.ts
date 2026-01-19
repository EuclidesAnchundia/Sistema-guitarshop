import dotenv from 'dotenv';
dotenv.config();

import { recalcCreditStatus } from '../lib/services/creditoService';
import prisma from '../src/shared/prisma/prismaClient';

(async () => {
  try {
    const types = await prisma.$queryRaw<Array<{ typname: string }>>`SELECT typname FROM pg_type WHERE typname ILIKE '%estado%'`;
    console.log('Enum types:', types);
    const labels = await prisma.$queryRaw<Array<{ enumlabel: string }>>`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'EstadoCredito'`;
    console.log('Enum labels:', labels);
    const res = await recalcCreditStatus(1);
    console.log('OK', res);
  } catch (err) {
    console.error('ERR', err);
    if (err instanceof Error) console.error(err.stack);
  }
})();