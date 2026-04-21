import { env } from "../config/env";
import { FirestoreDataStore, InMemoryDataStore, type IDataStore } from "./data-store";

let store: IDataStore | null = null;

export function getDataStore(): IDataStore {
  if (!store) {
    store = env.DATA_PROVIDER === "firestore" ? new FirestoreDataStore() : new InMemoryDataStore();
  }
  return store;
}

export function resetDataStoreForTests(nextStore?: IDataStore): void {
  store = nextStore ?? new InMemoryDataStore();
}

