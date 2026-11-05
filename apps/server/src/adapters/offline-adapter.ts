import type { CarId } from "@hijack/protocol";
import type { DeviceAdapter, DeviceEvent } from "../devices/types.ts";

export class OfflineHardwareAdapter implements DeviceAdapter {
  readonly mode = "hardware" as const;
  readonly carId: CarId;

  constructor(carId: CarId) {
    this.carId = carId;
  }

  isOnline(): boolean {
    return false;
  }

  drive(): void {}

  stop(): void {}

  pose(): null {
    return null;
  }

  onEvent(_listener: (e: DeviceEvent) => void): () => void {
    return () => {};
  }

  dispose(): void {}
}
