export type PaymentAuthorizationRequest = {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
};

export type PaymentCaptureRequest = {
  amount: number;
};

export type PaymentRefundRequest = {
  amount: number;
  reason: string;
};

export type AnalyticsNotificationEvent = {
  notificationId: string;
  requestId: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
};
