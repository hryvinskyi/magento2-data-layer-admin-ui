<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonAnswerInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\ProductSearchRequestReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ProductSearchInterface;
use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\Controller\Result\Json;

/**
 * Finds the products of a store view the setup wizard can preview a product page for: `?store=store:<id>&q=<text>`,
 * answered as a list of `{id, sku, name}`
 *
 * A store view that is not one of the store's answers 400 `{"error": reason}`; a failure of the server answers 500 with
 * a generic sentence and is logged.
 */
class Products extends Action implements HttpGetActionInterface
{
    /**
     * Access rule of the data layer's settings
     */
    public const ADMIN_RESOURCE = Index::ADMIN_RESOURCE;

    /**
     * @param Context $context
     * @param ProductSearchRequestReaderInterface $requestReader
     * @param ProductSearchInterface $search
     * @param JsonAnswerInterface $jsonAnswer
     */
    public function __construct(
        Context $context,
        private readonly ProductSearchRequestReaderInterface $requestReader,
        private readonly ProductSearchInterface $search,
        private readonly JsonAnswerInterface $jsonAnswer
    ) {
        parent::__construct($context);
    }

    /**
     * Search and answer with the products found
     *
     * @return Json
     */
    public function execute(): Json
    {
        return $this->jsonAnswer->answer('products', function (): array {
            $request = $this->requestReader->read($this->getRequest());

            return $this->search->search($request['storeId'], $request['query']);
        });
    }
}
