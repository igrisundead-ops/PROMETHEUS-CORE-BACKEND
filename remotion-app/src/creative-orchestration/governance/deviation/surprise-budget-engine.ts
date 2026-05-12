export class SurpriseBudgetEngine {
  private budget: number;
  private readonly maxBudget: number;

  constructor(initialBudget: number = 3) {
    this.budget = initialBudget;
    this.maxBudget = initialBudget;
  }

  hasBudget(): boolean {
    return this.budget > 0;
  }

  consume(): void {
    if (this.budget > 0) {
      this.budget--;
    }
  }

  // Budget can slowly replenish over long silence or low-energy scenes
  replenish(amount: number = 0.1): void {
    this.budget = Math.min(this.maxBudget, this.budget + amount);
  }

  getRemainingBudget(): number {
    return this.budget;
  }
}
