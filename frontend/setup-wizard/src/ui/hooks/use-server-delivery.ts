/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Whether anything delivers events from the server at the current scope, as the draft stands, and which step sets
 * it up. With no contribution registered nothing is delivered and no step is named.
 */
import { deliveryOf, type ServerDelivery } from '../../domain/server-delivery.ts';
import { useRuntimeValue } from '../../sdk/context.tsx';
import { useWizard } from './use-wizard.ts';

export function useServerDelivery(): ServerDelivery {
    const { runtime } = useRuntimeValue();
    const { view } = useWizard();
    return deliveryOf(runtime.serverDelivery, view);
}
