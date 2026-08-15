/**
 * Unified mechanical event system.
 *
 * Events emitted across the app:
 * keyTravel, linkage, impact, typebarRest, escapement, bell, clash,
 * shiftChange, carriageReturnStart, carriageReturnDone, paperFeed,
 * rejected, changed, structure.
 */
export type Handler<T = Record<string, unknown>> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<unknown>>>();

  on<T = Record<string, unknown>>(event: string, handler: Handler<T>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as unknown as Handler<unknown>);
    return () => set.delete(handler as unknown as Handler<unknown>);
  }

  emit<T>(event: string, payload: T): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
