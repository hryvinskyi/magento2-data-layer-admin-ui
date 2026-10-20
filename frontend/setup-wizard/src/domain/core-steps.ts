/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's own steps. Steps other modules contribute have ids of their own, which nothing here names.
 */
import { requireStepId, type StepId } from './steps.ts';

export const SCOPE_STEP: StepId = requireStepId('scope');
export const CONNECT_STEP: StepId = requireStepId('connect');
export const TRACK_STEP: StepId = requireStepId('track');
export const PRODUCTS_STEP: StepId = requireStepId('products');
export const REVIEW_STEP: StepId = requireStepId('review');
