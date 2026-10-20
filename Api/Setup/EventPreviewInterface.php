<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Shows what a storefront page of a store view would send with the settings the person has not saved yet
 *
 * The preview builds the event with the store's own event builders while the wizard's values are drafted over the
 * stored ones and price visibility gives the chosen viewer's answer, so it shows what saving those values would
 * do, without saving them. Nothing is persisted, queued or dispatched.
 *
 * @phpstan-type PreviewAnswer (
 *     array{status: 'sent', event: array<string, mixed>}
 *     | array{status: 'not_sent'|'unavailable', reason: string}
 * )
 * @api
 */
interface EventPreviewInterface
{
    /**
     * Preview an event
     *
     * @param int $storeId The store view whose page is previewed
     * @param string $kind The kind of event, as registered (`view_item`, `purchase`)
     * @param int|null $productId The product chosen for a product page; null when none is chosen
     * @param bool $priceVisible Whether the visitor sees prices, or may not
     * @param array<mixed> $settings The wizard's values for the store view, keyed by wizard setting key
     * @return PreviewAnswer The event as the page pushes it, or why it sends none or there is nothing to preview, in
     *     the admin's language
     * @throws InvalidSetupRequestException When the kind is not registered, the store view does not exist, or a
     *     setting key or value is not one the wizard takes
     */
    public function preview(int $storeId, string $kind, ?int $productId, bool $priceVisible, array $settings): array;
}
