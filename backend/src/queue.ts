export class InProcessQueue {
  private readonly concurrency: number;
  private activeCount = 0;
  private readonly pending: Array<() => Promise<void>> = [];
  private idleResolvers: Array<() => void> = [];

  public constructor(concurrency = 1) {
    this.concurrency = Math.max(1, concurrency);
  }

  public enqueue(task: () => Promise<void>): void {
    this.pending.push(task);
    this.drain();
  }

  public async onIdle(): Promise<void> {
    if (this.pending.length === 0 && this.activeCount === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private drain(): void {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) {
        continue;
      }
      this.activeCount += 1;
      void task()
        .catch(() => {
          // Worker errors are handled by the job processor and persisted in job state.
        })
        .finally(() => {
          this.activeCount -= 1;
          this.drain();
          if (this.pending.length === 0 && this.activeCount === 0) {
            const resolvers = this.idleResolvers.splice(0);
            resolvers.forEach((resolve) => resolve());
          }
        });
    }
  }
}
