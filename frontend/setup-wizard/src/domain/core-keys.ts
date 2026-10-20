/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The settings the wizard's own rules read: whether events are sent, and how pages load Google.
 */
import { requireSettingKey, type SettingKey } from './setting.ts';

export const ENABLED: SettingKey = requireSettingKey('enabled');
export const CONTAINER_ID: SettingKey = requireSettingKey('container_id');
export const MEASUREMENT_ID: SettingKey = requireSettingKey('measurement_id');
export const SCRIPT_HOST: SettingKey = requireSettingKey('script_host');
