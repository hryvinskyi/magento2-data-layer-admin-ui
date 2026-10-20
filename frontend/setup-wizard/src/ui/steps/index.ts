/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The wizard's own steps, registered like a plugin's (before any plugin's): scope, connect, what to track,
 * products and prices, review. They name no step another module contributes; a plugin step places itself after
 * one of these by its `after` id, and the review step stays last unless a plugin anchors itself to it.
 *
 * Each step's file contributes its behaviour (component, summary, checks); this file adds the id, glyph and the
 * phrase keys of its title and intro.
 */
import {
    CONNECT_STEP,
    PRODUCTS_STEP,
    REVIEW_STEP,
    SCOPE_STEP,
    TRACK_STEP,
    type PluginRegister,
    type StepContribution,
} from '@hryvinskyi/datalayer-setup';
import { connectStep } from './ConnectStep.tsx';
import { productsStep } from './ProductsStep.tsx';
import { reviewStep } from './ReviewStep.tsx';
import { scopeStep } from './ScopeStep.tsx';
import { trackStep } from './TrackStep.tsx';

export const BUILT_IN_STEPS: readonly StepContribution[] = Object.freeze([
    { id: SCOPE_STEP, icon: 'account_tree', title: 'step.scope.title', intro: 'step.scope.intro', ...scopeStep },
    { id: CONNECT_STEP, icon: 'link', title: 'step.connect.title', intro: 'step.connect.intro', ...connectStep },
    { id: TRACK_STEP, icon: 'checklist', title: 'step.track.title', intro: 'step.track.intro', ...trackStep },
    { id: PRODUCTS_STEP, icon: 'sell', title: 'step.products.title', intro: 'step.products.intro', ...productsStep },
    { id: REVIEW_STEP, icon: 'fact_check', title: 'step.review.title', intro: 'step.review.intro', ...reviewStep },
]);

/** Registers the wizard's own steps, in order. */
export const registerBuiltInSteps: PluginRegister = (sdk) => {
    BUILT_IN_STEPS.forEach((step) => sdk.registerStep(step));
};
