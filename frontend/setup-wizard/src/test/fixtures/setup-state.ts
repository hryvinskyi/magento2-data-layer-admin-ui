/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The fixtures' states as the domain sees them, and short ways to spell their ids in tests.
 */
import { parsePageConfig, type WirePageConfig } from '../../adapters/contract.ts';
import { requireEventName, type EventName } from '../../domain/events.ts';
import { requireScopeId, type ScopeId } from '../../domain/scope.ts';
import { requireSettingKey, type SettingKey } from '../../domain/setting.ts';
import type { SetupState } from '../../domain/setup-state.ts';
import { requireStepId, type StepId } from '../../domain/steps.ts';

export const stateOf = (config: WirePageConfig): SetupState => parsePageConfig(config).state;

export const scope = (raw: string): ScopeId => requireScopeId(raw);
export const key = (raw: string): SettingKey => requireSettingKey(raw);
export const step = (raw: string): StepId => requireStepId(raw);
export const eventName = (raw: string): EventName => requireEventName(raw);
