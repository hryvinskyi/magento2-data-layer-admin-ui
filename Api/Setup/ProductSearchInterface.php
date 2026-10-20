<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Finds the products of a store view the setup wizard can preview a product page for
 *
 * @api
 */
interface ProductSearchInterface
{
    /**
     * The fewest characters a search needs
     */
    public const MIN_QUERY_LENGTH = 2;

    /**
     * The most products one search returns
     */
    public const LIMIT = 10;

    /**
     * Find enabled products shown in the store view's catalog or search whose name or SKU contains the text
     *
     * The text is matched as typed: `%` and `_` are no wildcards. Names are the store view's own.
     *
     * @param int $storeId
     * @param string $query Trimmed before searching; shorter than the minimum finds nothing
     * @return list<array{id: int, sku: string, name: string}> At most the limit, by name
     * @throws InvalidSetupRequestException When the store view is not one of the store's
     */
    public function search(int $storeId, string $query): array;
}
