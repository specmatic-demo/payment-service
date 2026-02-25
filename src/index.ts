import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import mqtt from 'mqtt';
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
const analyticsMqttUrl = process.env.ANALYTICS_MQTT_URL || 'mqtt://localhost:1883';
const analyticsNotificationTopic = process.env.ANALYTICS_NOTIFICATION_TOPIC || 'notification/user';

function publishAnalyticsNotification(event: AnalyticsNotificationEvent): void {
  const client = mqtt.connect(analyticsMqttUrl, { reconnectPeriod: 0, connectTimeout: 1000 });
  const payload = JSON.stringify(event);
  let completed = false;

  const done = (): void => {
    if (completed) {
      return;
    }

    completed = true;
    client.end(true);
  };

  const timeout = setTimeout(() => {
    done();
  }, 1500);

  client.once('connect', () => {
    client.publish(analyticsNotificationTopic, payload, { qos: 1 }, (error?: Error | null) => {
      if (error) {
        console.error(`Failed to publish analytics notification on ${analyticsNotificationTopic}: ${error.message}`);
      }

      clearTimeout(timeout);
      done();
    });
  });

  client.once('error', (error: Error) => {
    console.error(`Failed to connect to analytics MQTT broker (${analyticsMqttUrl}): ${error.message}`);
    clearTimeout(timeout);
    done();
  });
}

app.post('/payments/authorize', (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as Partial<PaymentAuthorizationRequest>;
  const amount = payload.amount;

  if (typeof payload.orderId !== 'string' || typeof amount !== 'number' || !Number.isFinite(amount) || typeof payload.currency !== 'string' || payload.currency.length !== 3 || typeof payload.paymentMethodId !== 'string') {
    res.status(400).json({ error: 'Invalid payment authorization request' });
    return;
  }

  const paymentId = randomUUID();
  publishAnalyticsNotification({
    notificationId: randomUUID(),
    requestId: payload.orderId,
    title: 'PaymentAuthorized',
    body: `Payment ${paymentId} authorized for order ${payload.orderId}`,
    priority: 'HIGH'
  });

  res.status(200).json({
    paymentId,
    orderId: payload.orderId as string,
    status: 'AUTHORIZED',
    authorizedAmount: amount
  });
});

app.post('/payments/:paymentId/capture', (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const payload = (req.body ?? {}) as Partial<PaymentCaptureRequest>;
  const amount = payload.amount;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: 'Invalid capture request' });
    return;
  }

  publishAnalyticsNotification({
    notificationId: randomUUID(),
    requestId: paymentId,
    title: 'PaymentCaptured',
    body: `Payment ${paymentId} captured`,
    priority: 'NORMAL'
  });

  res.status(200).json({
    paymentId,
    status: 'CAPTURED',
    capturedAmount: amount,
    capturedAt: new Date().toISOString()
  });
});

app.post('/payments/:paymentId/refund', (req: Request, res: Response) => {
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
  publishAnalyticsNotification({
    notificationId: randomUUID(),
    requestId: paymentId,
    title: 'PaymentRefunded',
    body: `Refund ${refundId} requested for payment ${paymentId}`,
    priority: 'NORMAL'
  });

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
