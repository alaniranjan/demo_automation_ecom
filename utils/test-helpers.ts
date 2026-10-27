import * as allure from 'allure-js-commons';

/** "₹ 1,03,103", "₹2,469.05" or "Estimated Total ₹759.05" -> 103103, 2469.05, 759.05 (Indian digit grouping). */
export function parseRupees(text: string): number {
  const match = text.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match?.[1]) {
    throw new Error(`Unable to parse a rupee amount from "${text}"`);
  }
  return Number(match[1].replace(/,/g, ''));
}

/** "5% off", "20.01 off" or "(5% OFF)" -> 5, 20.01 */
export function parseDiscount(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%?\s*off/i);
  if (!match?.[1]) {
    throw new Error(`Unable to parse a discount from "${text}"`);
  }
  return Number(match[1]);
}

export interface CartLine {
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
}

/** Sums line prices x quantities in integer paise to avoid floating point drift. */
export function cartTotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + Math.round(line.price * 100) * line.quantity, 0) / 100;
}

export function isSorted(values: readonly number[], direction: 'asc' | 'desc'): boolean {
  return values.every((value, index) => {
    const previous = values[index - 1];
    if (previous === undefined) return true;
    return direction === 'asc' ? previous <= value : previous >= value;
  });
}

interface AllureLabels {
  readonly feature: string;
  readonly story?: string;
  readonly severity?: allure.Severity;
}

/** Groups tests in the Allure "Behaviors" view: epic > feature > story. */
export async function labelTest({ feature, story, severity }: AllureLabels): Promise<void> {
  await allure.epic('Demo Store');
  await allure.feature(feature);
  if (story) {
    await allure.story(story);
  }
  if (severity) {
    await allure.severity(severity);
  }
}
