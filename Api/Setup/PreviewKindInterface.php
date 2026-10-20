<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;

/**
 * One kind of event the setup wizard previews: finds what the event is built from, builds it, and says why when it
 * is not built
 *
 * A kind is registered as an item of the `kinds` argument of the event preview, keyed by the kind the browser asks
 * for. It runs while the wizard's unsaved settings are drafted, price visibility gives the viewer's answer and the
 * store view is emulated as the storefront, so it builds exactly what a page of that store view would send. It
 * builds only: nothing is saved, queued or handed to the event dispatcher.
 *
 * @api
 */
interface PreviewKindInterface
{
    /**
     * Preview the event in a store view
     *
     * @param int $storeId The store view previewed; it is the current store view while this runs
     * @param int|null $productId The product the person chose; null when none is chosen
     * @return PreviewOutcomeInterface
     */
    public function preview(int $storeId, ?int $productId): PreviewOutcomeInterface;
}
