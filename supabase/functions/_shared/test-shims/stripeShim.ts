import { createHmac, timingSafeEqual } from "node:crypto";

type AsyncHandler<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

interface StripeMockState {
  customersList: AsyncHandler<[unknown], unknown>;
  customersRetrieve: AsyncHandler<[unknown], unknown>;
  subscriptionsList: AsyncHandler<[unknown], unknown>;
  subscriptionsRetrieve: AsyncHandler<[unknown], unknown>;
}

const unsupported = (name: string) => async () => {
  throw new Error(`Stripe mock handler not configured for ${name}`);
};

let mockState: StripeMockState = {
  customersList: unsupported("customers.list"),
  customersRetrieve: unsupported("customers.retrieve"),
  subscriptionsList: unsupported("subscriptions.list"),
  subscriptionsRetrieve: unsupported("subscriptions.retrieve"),
};

function parseSignatureHeader(signature: string): { timestamp: string; v1: string } | null {
  const parts = signature.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const v1 = parts.find((part) => part.startsWith("v1="))?.slice(3);

  if (!timestamp || !v1) {
    return null;
  }

  return { timestamp, v1 };
}

function verifySignature(body: string, signature: string, secret: string): void {
  const parsed = parseSignatureHeader(signature);
  if (!parsed) {
    throw new Error("Invalid signature header");
  }

  const signedPayload = `${parsed.timestamp}.${body}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(parsed.v1, "utf8");

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid signature");
  }
}

export const __createStripeSignature = (
  body: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string => {
  const payload = `${timestamp}.${body}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
};

export const __setStripeMockState = (partial: Partial<StripeMockState>): void => {
  mockState = {
    ...mockState,
    ...partial,
  };
};

export const __resetStripeMockState = (): void => {
  mockState = {
    customersList: unsupported("customers.list"),
    customersRetrieve: unsupported("customers.retrieve"),
    subscriptionsList: unsupported("subscriptions.list"),
    subscriptionsRetrieve: unsupported("subscriptions.retrieve"),
  };
};

export default class Stripe {
  constructor(_key: string, _options?: unknown) {}

  webhooks = {
    constructEventAsync: async (body: string, signature: string, secret: string) => {
      verifySignature(body, signature, secret);
      return JSON.parse(body);
    },
  };

  customers = {
    list: async (args: unknown) => mockState.customersList(args),
    retrieve: async (args: unknown) => mockState.customersRetrieve(args),
  };

  subscriptions = {
    list: async (args: unknown) => mockState.subscriptionsList(args),
    retrieve: async (args: unknown) => mockState.subscriptionsRetrieve(args),
  };
}
