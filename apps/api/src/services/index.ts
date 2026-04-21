import type { IDataStore } from "../repositories/data-store";
import { getDataStore, resetDataStoreForTests } from "../repositories";
import { PlatformService } from "./platform";

let platformService: PlatformService | null = null;

export function getPlatformService(): PlatformService {
  if (!platformService) {
    platformService = new PlatformService(getDataStore());
  }
  return platformService;
}

export function resetPlatformServiceForTests(store?: IDataStore): void {
  resetDataStoreForTests(store);
  platformService = null;
}
