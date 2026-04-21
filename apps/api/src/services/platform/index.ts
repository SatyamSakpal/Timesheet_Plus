import type { IDataStore } from "../../repositories/data-store";
import { ActivityService } from "./activity.service";

/**
 * PlatformService is the public façade used by routes.
 * Internally, behavior is split by domain through inherited service layers.
 */
export class PlatformService extends ActivityService {
  constructor(store: IDataStore) {
    super(store);
  }
}

