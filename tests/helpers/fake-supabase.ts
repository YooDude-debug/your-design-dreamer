/**
 * Minimaler Ersatz für den Datenbank-Client in Tests.
 *
 * Zweck: Server-Logik (Berechtigungen, Statuswechsel, Idempotenz) prüfen, ohne
 * die Produktionsdatenbank zu berühren. Es wird kein SQL ausgeführt – jeder
 * Aufruf wird protokolliert und über eine frei definierbare Antwortfunktion
 * beantwortet.
 */

export type FakeCall = {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: Array<{ op: string; column?: string; value?: unknown }>;
  single: boolean;
};

export type FakeResponse = { data?: unknown; error?: { message: string } | null; count?: number };

export type FakeResolver = (call: FakeCall) => FakeResponse;

type RpcCall = { fn: string; args: unknown };

export type FakeDb = {
  from(table: string): Builder;
  rpc(fn: string, args?: unknown): Promise<FakeResponse>;
  calls: FakeCall[];
  rpcs: RpcCall[];
  /** Alle Aufrufe auf eine Tabelle, optional nach Aktion gefiltert. */
  callsOn(table: string, action?: FakeCall["action"]): FakeCall[];
};

class Builder implements PromiseLike<FakeResponse> {
  private call: FakeCall;
  constructor(
    table: string,
    private resolver: FakeResolver,
    private log: FakeCall[],
  ) {
    this.call = { table, action: "select", filters: [], single: false };
    this.log.push(this.call);
  }

  private filter(op: string, column?: string, value?: unknown): this {
    this.call.filters.push({ op, column, value });
    return this;
  }

  select(_columns?: string, _opts?: unknown): this {
    return this;
  }
  insert(payload: unknown): this {
    this.call.action = "insert";
    this.call.payload = payload;
    return this;
  }
  update(payload: unknown): this {
    this.call.action = "update";
    this.call.payload = payload;
    return this;
  }
  upsert(payload: unknown, _opts?: unknown): this {
    this.call.action = "upsert";
    this.call.payload = payload;
    return this;
  }
  delete(): this {
    this.call.action = "delete";
    return this;
  }
  eq(column: string, value: unknown): this {
    return this.filter("eq", column, value);
  }
  neq(column: string, value: unknown): this {
    return this.filter("neq", column, value);
  }
  gte(column: string, value: unknown): this {
    return this.filter("gte", column, value);
  }
  lte(column: string, value: unknown): this {
    return this.filter("lte", column, value);
  }
  in(column: string, value: unknown): this {
    return this.filter("in", column, value);
  }
  is(column: string, value: unknown): this {
    return this.filter("is", column, value);
  }
  or(expr: string): this {
    return this.filter("or", undefined, expr);
  }
  order(column: string, _opts?: unknown): this {
    return this.filter("order", column);
  }
  limit(n: number): this {
    return this.filter("limit", undefined, n);
  }
  range(a: number, b: number): this {
    return this.filter("range", undefined, [a, b]);
  }
  maybeSingle(): Promise<FakeResponse> {
    this.call.single = true;
    return this.run();
  }
  single(): Promise<FakeResponse> {
    this.call.single = true;
    return this.run();
  }

  private async run(): Promise<FakeResponse> {
    const res = this.resolver(this.call);
    return { data: null, error: null, ...res };
  }

  then<T1 = FakeResponse, T2 = never>(
    onfulfilled?: ((value: FakeResponse) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export function createFakeDb(resolver: FakeResolver = () => ({})): FakeDb {
  const calls: FakeCall[] = [];
  const rpcs: RpcCall[] = [];
  return {
    from: (table: string) => new Builder(table, resolver, calls),
    rpc: async (fn: string, args?: unknown) => {
      rpcs.push({ fn, args });
      return resolver({ table: `rpc:${fn}`, action: "select", filters: [], single: true, payload: args });
    },
    calls,
    rpcs,
    callsOn: (table, action) =>
      calls.filter((c) => c.table === table && (action ? c.action === action : true)),
  };
}

/** Standard-Transaktionszeile für Market-Tests. */
export function txRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx-1",
    reference: "YD-TX-1",
    item_id: "item-1",
    offer_id: null,
    seller_id: "seller-1",
    buyer_id: "buyer-1",
    conversation_id: "conv-1",
    quantity: 1,
    currency: "EUR",
    item_price_cents: 2000,
    shipping_price_cents: 500,
    platform_fee_cents: 100,
    payment_fee_cents: 50,
    seller_amount_cents: 2350,
    total_cents: 2500,
    fulfillment_type: "shipping",
    status: "processing",
    payment_status: "paid",
    shipping_status: "awaiting_shipment",
    paid_at: new Date().toISOString(),
    completed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
