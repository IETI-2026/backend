import { registerAs } from '@nestjs/config';

export default registerAs('epayco', () => ({
  customerId: process.env.EPAYCO_P_CUST_ID ?? '',
  privateKey: process.env.EPAYCO_P_KEY ?? '',
}));
