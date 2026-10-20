<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\LoaderStatus;

use Hryvinskyi\DataLayer\Api\ConfigInterface;

/**
 * Tells from a scope's settings whether the storefront outputs the Tag Manager loader, and from where
 *
 * The storefront outputs it when the data layer is on and the container id is one; it loads `gtm.js` from the
 * script host, or from Google's own host when none is set.
 */
class LoaderStatusResolver
{
    private const LOADER_URL = 'https://%s/gtm.js?id=%s';

    /**
     * Resolve the loader status of a scope's settings
     *
     * @param mixed $enabled The data layer's on/off setting
     * @param mixed $containerId The container id setting
     * @param mixed $scriptHost The script host setting
     * @return array{state: LoaderState, url: string} The address is empty unless the loader is output
     */
    public function resolve(mixed $enabled, mixed $containerId, mixed $scriptHost): array
    {
        $containerId = is_scalar($containerId) ? trim((string) $containerId) : '';
        if (!is_scalar($enabled) || (string) $enabled !== '1') {
            return ['state' => LoaderState::Disabled, 'url' => ''];
        }
        if ($containerId === '') {
            return ['state' => LoaderState::NoContainer, 'url' => ''];
        }
        if (preg_match(ConfigInterface::CONTAINER_ID_PATTERN, $containerId) !== 1) {
            return ['state' => LoaderState::InvalidContainer, 'url' => ''];
        }
        $host = is_scalar($scriptHost) ? trim((string) $scriptHost) : '';

        return [
            'state' => LoaderState::Output,
            'url' => sprintf(
                self::LOADER_URL,
                $host !== '' ? $host : ConfigInterface::DEFAULT_SCRIPT_HOST,
                rawurlencode($containerId)
            ),
        ];
    }
}
