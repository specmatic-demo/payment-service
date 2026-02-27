import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { Kafka, type Producer } from 'kafkajs';
import type {
  AnalyticsNotificationEvent,
  PaymentAuthorizationRequest,
  PaymentCaptureRequest,
  PaymentRefundRequest
} from './types';

const app = express();
app.use(express.json({ limit: '1mb' }));

const host = process.env.PAYMENT_HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PAYMENT_PORT || '9000', 10);
const analyticsKafkaBrokers = (process.env.ANALYTICS_KAFKA_BROKERS || 'localhost:9092')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const analyticsNotificationTopic = process.env.ANALYTICS_NOTIFICATION_TOPIC || 'notification.user';

const kafka = new Kafka({
  clientId: 'payment-service-analytics',
  brokers: analyticsKafkaBrokers
});
const analyticsProducer: Producer = kafka.producer();
let analyticsProducerConnected = false;

async function ensureAnalyticsProducerConnected(): Promise<void> {
  if (analyticsProducerConnected) {
    return;
  }

  await analyticsProducer.connect();
  analyticsProducerConnected = true;
}

async function publishAnalyticsNotification(event: AnalyticsNotificationEvent): Promise<void> {
  await ensureAnalyticsProducerConnected();
  await analyticsProducer.send({
    topic: analyticsNotificationTopic,
    messages: [{ key: event.requestId, value: JSON.stringify(event) }]
  });
}

app.post('/payments/authorize', async (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as Partial<PaymentAuthorizationRequest>;
  const amount = payload.amount;

  if (typeof payload.orderId !== 'string' || typeof amount !== 'number' || !Number.isFinite(amount) || typeof payload.currency !== 'string' || payload.currency.length !== 3 || typeof payload.paymentMethodId !== 'string') {
    res.status(400).json({ error: 'Invalid payment authorization request' });
    return;
  }

  const paymentId = randomUUID();
  try {
    await publishAnalyticsNotification({
      notificationId: randomUUID(),
      requestId: payload.orderId,
      title: 'PaymentAuthorized',
      body: `Payment ${paymentId} authorized for order ${payload.orderId}`,
      priority: 'HIGH'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to publish analytics notification on ${analyticsNotificationTopic}: ${message}`);
  }

  res.status(200).json({
    paymentId,
    orderId: payload.orderId as string,
    status: 'AUTHORIZED',
    authorizedAmount: amount
  });
});

app.post('/payments/:paymentId/capture', async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const payload = (req.body ?? {}) as Partial<PaymentCaptureRequest>;
  const amount = payload.amount;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: 'Invalid capture request' });
    return;
  }

  try {
    await publishAnalyticsNotification({
      notificationId: randomUUID(),
      requestId: paymentId,
      title: 'PaymentCaptured',
      body: `Payment ${paymentId} captured`,
      priority: 'NORMAL'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to publish analytics notification on ${analyticsNotificationTopic}: ${message}`);
  }

  res.status(200).json({
    paymentId,
    status: 'CAPTURED',
    capturedAmount: amount,
    capturedAt: new Date().toISOString()
  });
});

app.post('/payments/:paymentId/refund', async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const payload = (req.body ?? {}) as Partial<PaymentRefundRequest>;
  const amount = payload.amount;

  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < 0.01 ||
    typeof payload.reason !== 'string' ||
    payload.reason.length > 256
  ) {
    res.status(400).json({ error: 'Invalid refund request' });
    return;
  }

  const refundId = randomUUID();
  try {
    await publishAnalyticsNotification({
      notificationId: randomUUID(),
      requestId: paymentId,
      title: 'PaymentRefunded',
      body: `Refund ${refundId} requested for payment ${paymentId}`,
      priority: 'NORMAL'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to publish analytics notification on ${analyticsNotificationTopic}: ${message}`);
  }

  res.status(200).json({
    paymentId,
    refundId,
    status: 'REFUNDED',
    refundedAmount: amount,
    refundedAt: new Date().toISOString()
  });
});

app.listen(port, host, () => {
  console.log(`payment-service listening on http://${host}:${port}`);
});
