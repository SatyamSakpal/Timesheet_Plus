import { getFirestore } from "../config/firebase";
import type { CollectionName } from "../types/domain";

export type QueryOp = "==" | "in" | "array-contains" | ">=" | "<=";

export interface QueryFilter {
  field: string;
  op: QueryOp;
  value: unknown;
}

export interface QueryOptions {
  orderBy?: string;
  direction?: "asc" | "desc";
  limit?: number;
}

export interface IDataStore {
  getById<T>(collection: CollectionName, id: string): Promise<T | null>;
  set<T extends { id: string }>(collection: CollectionName, id: string, data: T): Promise<void>;
  create<T extends { id: string }>(collection: CollectionName, data: T): Promise<T>;
  delete(collection: CollectionName, id: string): Promise<void>;
  update<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    patch: Partial<T>
  ): Promise<T>;
  query<T>(
    collection: CollectionName,
    filters?: QueryFilter[],
    options?: QueryOptions
  ): Promise<T[]>;
}

function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return undefined as T;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as T;
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripUndefinedDeep(entry);
      if (cleaned !== undefined) {
        output[key] = cleaned;
      }
    }
    return output as T;
  }
  return value;
}

function compareValue(left: unknown, op: QueryOp, right: unknown): boolean {
  if (op === "==") {
    return left === right;
  }
  if (op === "in") {
    return Array.isArray(right) && right.includes(left);
  }
  if (op === "array-contains") {
    return Array.isArray(left) && left.includes(right);
  }
  if (op === ">=") {
    return typeof left === "string" && typeof right === "string" ? left >= right : Number(left) >= Number(right);
  }
  if (op === "<=") {
    return typeof left === "string" && typeof right === "string" ? left <= right : Number(left) <= Number(right);
  }
  return false;
}

export class InMemoryDataStore implements IDataStore {
  // Simple map-backed store for local development and tests.
  private readonly collections = new Map<string, Map<string, unknown>>();

  private getCollection(collection: CollectionName): Map<string, unknown> {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Map<string, unknown>());
    }
    return this.collections.get(collection)!;
  }

  async getById<T>(collection: CollectionName, id: string): Promise<T | null> {
    const record = this.getCollection(collection).get(id);
    return record ? clone(record as T) : null;
  }

  async set<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    data: T
  ): Promise<void> {
    this.getCollection(collection).set(id, clone(data));
  }

  async create<T extends { id: string }>(collection: CollectionName, data: T): Promise<T> {
    this.getCollection(collection).set(data.id, clone(data));
    return clone(data);
  }

  async delete(collection: CollectionName, id: string): Promise<void> {
    this.getCollection(collection).delete(id);
  }

  async update<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    patch: Partial<T>
  ): Promise<T> {
    const existing = (await this.getById<T>(collection, id)) as T | null;
    if (!existing) {
      throw new Error(`Document not found: ${collection}/${id}`);
    }
    const merged = { ...existing, ...clone(patch), id } as T;
    this.getCollection(collection).set(id, merged);
    return clone(merged);
  }

  async query<T>(
    collection: CollectionName,
    filters: QueryFilter[] = [],
    options?: QueryOptions
  ): Promise<T[]> {
    const records = [...this.getCollection(collection).values()].map((entry) =>
      clone(entry as T)
    );

    let result = records.filter((record) => {
      return filters.every((filter) => {
        const value = (record as Record<string, unknown>)[filter.field];
        return compareValue(value, filter.op, filter.value);
      });
    });

    if (options?.orderBy) {
      const direction = options.direction ?? "asc";
      result = result.sort((a, b) => {
        const left = (a as Record<string, unknown>)[options.orderBy!];
        const right = (b as Record<string, unknown>)[options.orderBy!];
        if (left === right) {
          return 0;
        }
        if (left === undefined || left === null) {
          return direction === "asc" ? -1 : 1;
        }
        if (right === undefined || right === null) {
          return direction === "asc" ? 1 : -1;
        }
        return left < right
          ? direction === "asc"
            ? -1
            : 1
          : direction === "asc"
            ? 1
            : -1;
      });
    }

    if (options?.limit !== undefined) {
      result = result.slice(0, options.limit);
    }

    return result;
  }
}

export class FirestoreDataStore implements IDataStore {
  private readonly db = getFirestore();

  async getById<T>(collection: CollectionName, id: string): Promise<T | null> {
    const snapshot = await this.db.collection(collection).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }
    return snapshot.data() as T;
  }

  async set<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    data: T
  ): Promise<void> {
    await this.db.collection(collection).doc(id).set(stripUndefinedDeep(data));
  }

  async create<T extends { id: string }>(collection: CollectionName, data: T): Promise<T> {
    await this.db.collection(collection).doc(data.id).set(stripUndefinedDeep(data));
    return data;
  }

  async delete(collection: CollectionName, id: string): Promise<void> {
    await this.db.collection(collection).doc(id).delete();
  }

  async update<T extends { id: string }>(
    collection: CollectionName,
    id: string,
    patch: Partial<T>
  ): Promise<T> {
    const ref = this.db.collection(collection).doc(id);
    await ref.set(stripUndefinedDeep(patch) as Record<string, unknown>, { merge: true });
    const next = await ref.get();
    return next.data() as T;
  }

  async query<T>(
    collection: CollectionName,
    filters: QueryFilter[] = [],
    options?: QueryOptions
  ): Promise<T[]> {
    let query:
      | FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
      | FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData> =
      this.db.collection(collection);

    for (const filter of filters) {
      query = query.where(
        filter.field,
        filter.op as FirebaseFirestore.WhereFilterOp,
        filter.value
      );
    }

    if (options?.orderBy) {
      query = query.orderBy(options.orderBy, options.direction ?? "asc");
    }
    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as T);
  }
}
