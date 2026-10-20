<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventPreviewInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonAnswerInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\PreviewRequestReaderInterface;
use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\Action\HttpPostActionInterface;
use Magento\Framework\Controller\Result\Json;

/**
 * Previews the event a store view's page would send with the setup wizard's unsaved values
 *
 * The body is JSON; the admin form key travels in the query string, where the admin checks it before this runs. A
 * request the preview cannot run answers 400 `{"error": reason}`; a failure of the server answers 500 with a generic
 * sentence and is logged.
 */
class Preview extends Action implements HttpPostActionInterface
{
    /**
     * Access rule of the data layer's settings
     */
    public const ADMIN_RESOURCE = Index::ADMIN_RESOURCE;

    /**
     * @param Context $context
     * @param PreviewRequestReaderInterface $requestReader
     * @param EventPreviewInterface $preview
     * @param JsonAnswerInterface $jsonAnswer
     */
    public function __construct(
        Context $context,
        private readonly PreviewRequestReaderInterface $requestReader,
        private readonly EventPreviewInterface $preview,
        private readonly JsonAnswerInterface $jsonAnswer
    ) {
        parent::__construct($context);
    }

    /**
     * Preview and answer with the event, or why none is sent or there is nothing to preview
     *
     * @return Json
     */
    public function execute(): Json
    {
        return $this->jsonAnswer->answer('preview', function (): array {
            $request = $this->requestReader->read($this->getRequest());

            return $this->preview->preview(
                $request['storeId'],
                $request['kind'],
                $request['productId'],
                $request['priceVisible'],
                $request['settings']
            );
        });
    }
}
