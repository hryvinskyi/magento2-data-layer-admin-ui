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
 * Reads a product search of the setup wizard from its query string: `store` (`store:<id>`) and `q`, the text
 *
 * @api
 */
interface ProductSearchRequestReaderInterface
{
    /**
     * Read what to search
     *
     * @param RequestInterface $request
     * @return array{storeId: int, query: string} A missing text is an empty one
     * @throws InvalidSetupRequestException When the store view is missing or not a store view's scope id, or the
     *     text is not text; the reason says which
     */
    public function read(RequestInterface $request): array;
}
