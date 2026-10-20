/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * How the purchase value is chosen. Only a value taken from the grand total can have tax deducted from it, so the
 * "deduct tax" option has meaning (and is shown) only then.
 */
import { textOf, type SettingValue } from './setting.ts';

/** The purchase-value basis that reports the order's grand total. */
export const GRAND_TOTAL_BASIS = 'grand_total';

/** Whether "deduct tax" applies to the purchase value basis in effect. */
export const deductTaxApplies = (basis: SettingValue | undefined): boolean => textOf(basis) === GRAND_TOTAL_BASIS;
