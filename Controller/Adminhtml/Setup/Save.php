<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonAnswerInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\SaveRequestReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupSaverInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;
use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\Action\HttpPostActionInterface;
use Magento\Framework\Controller\Result\Json;

/**
 * Saves the setup wizard's changes and answers with the result of each and the state after the save
 *
 * The body is JSON (`{"changes": [...]}`); the admin form key travels in the query string, where the admin checks it
 * before this runs. A request the saver refuses as a whole writes nothing and answers 400 `{"error": reason}`; a
 * failure of the server answers 500 with a generic sentence and is logged.
 */
class Save extends Action implements HttpPostActionInterface
{
    /**
     * Access rule of the data layer's settings
     */
    public const ADMIN_RESOURCE = Index::ADMIN_RESOURCE;

    /**
     * @param Context $context
     * @param SaveRequestReaderInterface $requestReader
     * @param SetupSaverInterface $saver
     * @param SetupStateProviderInterface $stateProvider
     * @param JsonAnswerInterface $jsonAnswer
     */
    public function __construct(
        Context $context,
        private readonly SaveRequestReaderInterface $requestReader,
        private readonly SetupSaverInterface $saver,
        private readonly SetupStateProviderInterface $stateProvider,
        private readonly JsonAnswerInterface $jsonAnswer
    ) {
        parent::__construct($context);
    }

    /**
     * Save the changes and answer `{"results": [...], "state": {...}}`
     *
     * @return Json
     */
    public function execute(): Json
    {
        return $this->jsonAnswer->answer('save', fn (): array => [
            'results' => $this->saver->save($this->requestReader->read($this->getRequest())),
            'state' => $this->stateProvider->getState(),
        ]);
    }
}
