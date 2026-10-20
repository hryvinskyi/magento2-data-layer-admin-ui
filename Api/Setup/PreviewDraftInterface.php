<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Turns the wizard values a preview is asked for into the drafted config values it runs against
 *
 * Each wizard setting becomes its config paths with the values its save would store. The events setting becomes the
 * disabled-events list, made of the events it switches off; its channels are left out, since a channel decides
 * where an event goes, not what it holds. A secret is left out: it never shows in an event.
 *
 * @api
 */
interface PreviewDraftInterface
{
    /**
     * Turn wizard values into drafted config values
     *
     * @param array<mixed> $settings Wire values keyed by wizard setting key
     * @return array<string, string> Raw values in their stored form, keyed by config path
     * @throws InvalidSetupRequestException When a key names no wizard setting, or a value is not one its setting
     *     takes
     */
    public function toDraft(array $settings): array;
}
