<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\ProductSearchRequestReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\StoreViewParameterInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Magento\Framework\App\RequestInterface;

/**
 * Reads the store view and the text from the query string; the text is handed on as typed, for the search to trim
 */
class ProductSearchRequestReader implements ProductSearchRequestReaderInterface
{
    /**
     * @param StoreViewParameterInterface $storeView
     */
    public function __construct(
        private readonly StoreViewParameterInterface $storeView
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(RequestInterface $request): array
    {
        $query = $request->getParam('q') ?? '';
        if (!is_string($query)) {
            throw new InvalidSetupRequestException(__('The product search needs its text as text.'));
        }

        return ['storeId' => $this->storeView->read($request->getParam('store')), 'query' => $query];
    }
}
