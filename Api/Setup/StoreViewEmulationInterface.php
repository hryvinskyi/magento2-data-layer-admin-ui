<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Runs work as the storefront of a store view
 *
 * While the work runs, the store view is the current one, with its storefront design and its locale; everything is
 * restored when the work returns or throws. Text rendered during the work is rendered in the store view's language,
 * so a caller that shows text to an admin renders it after the work has returned.
 *
 * @api
 */
interface StoreViewEmulationInterface
{
    /**
     * Run work as the storefront of a store view
     *
     * @template T
     * @param int $storeId
     * @param callable $work
     * @phpstan-param callable(): T $work
     * @return T What the work returned
     */
    public function run(int $storeId, callable $work): mixed;
}
