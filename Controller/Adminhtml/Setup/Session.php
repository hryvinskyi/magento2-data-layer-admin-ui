<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Http\JsonAnswerInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupSessionInterface;
use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\Controller\Result\Json;

/**
 * Answers the setup wizard's page with the current admin session's form key and addresses:
 * `{"formKey": text, "endpoints": {...}, "links": {"advanced": {...}, "close": {...}}}`
 *
 * It is reached without the URL secret key, since the page asks for it exactly when its keys have stopped working,
 * but it still needs a signed-in admin user the data layer's settings rule allows. Asked as AJAX by a page whose
 * session has ended, the admin answers it with its own "session expired" JSON.
 */
class Session extends Action implements HttpGetActionInterface
{
    /**
     * Access rule of the data layer's settings
     */
    public const ADMIN_RESOURCE = Index::ADMIN_RESOURCE;

    /**
     * Actions reached without the URL secret key
     *
     * @var string[]
     */
    protected $_publicActions = ['session'];

    /**
     * @param Context $context
     * @param SetupSessionInterface $session
     * @param JsonAnswerInterface $jsonAnswer
     */
    public function __construct(
        Context $context,
        private readonly SetupSessionInterface $session,
        private readonly JsonAnswerInterface $jsonAnswer
    ) {
        parent::__construct($context);
    }

    /**
     * Answer with the session's form key and addresses
     *
     * @return Json
     */
    public function execute(): Json
    {
        return $this->jsonAnswer->answer('session', fn (): array => $this->session->describe());
    }
}
