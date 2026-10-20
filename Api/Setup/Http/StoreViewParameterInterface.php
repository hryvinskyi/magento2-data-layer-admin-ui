<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;

/**
 * Reads the store view a setup wizard request names, written as the wizard writes a store view's scope id
 * (`store:<store view id>`)
 *
 * @api
 */
interface StoreViewParameterInterface
{
    /**
     * Read the store view id
     *
     * Whether the store view exists is for the use case to say.
     *
     * @param mixed $value The value as the request carried it
     * @return int
     * @throws InvalidSetupRequestException When the value is not a store view's scope id; the reason says so
     */
    public function read(mixed $value): int;
}
