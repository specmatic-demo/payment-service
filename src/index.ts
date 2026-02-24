import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

const host = process.env.PAYMENT_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PAYMENT_PORT || '9000', 10);

type PaymentAuthorizationRequest = {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
};

app.post('/payments/authorize', (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as Partial<PaymentAuthorizationRequest>;
  const amount = payload.amount;

  if (typeof payload.orderId !== 'string' || typeof amount !== 'number' || !Number.isFinite(amount) || typeof payload.currency !== 'string' || payload.currency.length !== 3 || typeof payload.paymentMethodId !== 'string') {
    res.status(400).json({ error: 'Invalid payment authorization request' });
    return;
  }

  res.status(200).json({
    paymentId: randomUUID(),
    orderId: payload.orderId as string,
    status: 'AUTHORIZED',
    authorizedAmount: amount
  });
});

app.listen(port, host, () => {
  console.log(`payment-service listening on http://${host}:${port}`);
});
