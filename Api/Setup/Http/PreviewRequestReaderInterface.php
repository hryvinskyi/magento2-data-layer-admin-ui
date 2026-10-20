<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Magento\Framework\App\RequestInterface;

/**
 * Reads a preview request of the setup wizard: a JSON body
 * `{"store": "store:<id>", "kind": text, "product": positive whole number or null, "priceVisible": bool,
 * "settings": object}`
 *
 * Each field's type is checked here; whether the kind is registered, the store view exists and the settings are the
 * wizard's is for the preview to say.
 *
 * @phpstan-type PreviewRequest array{
 *     storeId: int,
 *     kind: string,
 *     productId: int|null,
 *     priceVisible: bool,
 *     settings: array<mixed>
 * }
 * @api
 */
interface PreviewRequestReaderInterface
{
    /**
     * Read what to preview
     *
     * @param RequestInterface $request
     * @return PreviewRequest
     * @throws InvalidSetupRequestException When a field is missing or of the wrong type; the reason says which
     */
    public function read(RequestInterface $request): array;
}
