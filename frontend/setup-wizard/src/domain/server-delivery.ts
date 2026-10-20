/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Whether anything delivers events from the server, as the wizard's draft stands. The core knows no delivery of its
 * own: a module that adds one registers it here, naming the step that sets it up. With nothing registered every
 * non-browser channel is "not delivered" and no step is offered to fix it.
 */
import type { StepId } from './steps.ts';
import type { SettingsView } from './view.ts';

export interface ServerDeliveryContribution {
    readonly stepId: StepId;
    isOn(view: SettingsView): boolean;
}

export interface ServerDelivery {
    readonly on: boolean;
    readonly stepId: StepId | null;
}

/** A second contribution: the page can only show one answer, so it fails loudly instead of picking one. */
export class ServerDeliveryTakenError extends Error {
    readonly stepId: StepId;

    constructor(stepId: StepId) {
        super(`Server delivery is already contributed by step ${stepId}`);
        this.name = 'ServerDeliveryTakenError';
        this.stepId = stepId;
    }
}

export interface ServerDeliveryRegistry {
    /** @throws ServerDeliveryTakenError */
    register(contribution: ServerDeliveryContribution): void;
    contribution(): ServerDeliveryContribution | null;
}

export function createServerDeliveryRegistry(): ServerDeliveryRegistry {
    let registered: ServerDeliveryContribution | null = null;
    return Object.freeze({
        register: (contribution: ServerDeliveryContribution): void => {
            if (registered !== null) {
                throw new ServerDeliveryTakenError(registered.stepId);
            }
            registered = contribution;
        },
        contribution: (): ServerDeliveryContribution | null => registered,
    });
}

export function deliveryOf(registry: ServerDeliveryRegistry, view: SettingsView): ServerDelivery {
    const contribution = registry.contribution();
    if (contribution === null) {
        return { on: false, stepId: null };
    }
    return { on: contribution.isOn(view), stepId: contribution.stepId };
}
