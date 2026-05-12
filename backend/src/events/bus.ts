import { EventEmitter } from "node:events";

export type DomainEvent = {
  type: string;
  payload: Record<string, unknown>;
  jobId?: string;
  txHash?: string;
  blockNumber?: string;
};

class Bus extends EventEmitter {
  publish(event: DomainEvent) {
    this.emit("event", event);
    this.emit(event.type, event);
  }
}

export const eventBus = new Bus();

