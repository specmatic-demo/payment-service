'use strict';

const express = require('express');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));

const host = process.env.PAYMENT_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PAYMENT_PORT || '9000', 10);

app.post('/payments/authorize', (req, res) => {
  const payload = req.body || {};
  const amount = Number(payload.amount);

  if (typeof payload.orderId !== 'string' || !Number.isFinite(amount) || typeof payload.currency !== 'string' || payload.currency.length !== 3 || typeof payload.paymentMethodId !== 'string') {
    res.status(400).json({ error: 'Invalid payment authorization request' });
    return;
  }

  res.status(200).json({
    paymentId: randomUUID(),
    orderId: payload.orderId,
    status: 'AUTHORIZED',
    authorizedAmount: amount
  });
});

app.listen(port, host, () => {
  console.log(`payment-service listening on http://${host}:${port}`);
});
