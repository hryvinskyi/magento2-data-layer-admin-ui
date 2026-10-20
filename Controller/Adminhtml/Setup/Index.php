<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup;

use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Backend\Model\View\Result\Page;
use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\View\Result\PageFactory;

/**
 * Shows the setup wizard's page under its admin menu item; its title, breadcrumbs and content come from the page's
 * layout
 */
class Index extends Action implements HttpGetActionInterface
{
    /**
     * Access rule of the data layer's settings, which the wizard edits
     */
    public const ADMIN_RESOURCE = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * The admin menu item the page belongs to
     */
    public const MENU_ITEM = 'Hryvinskyi_DataLayerAdminUi::setup_menu';

    /**
     * @param Context $context
     * @param PageFactory $pageFactory
     */
    public function __construct(
        Context $context,
        private readonly PageFactory $pageFactory
    ) {
        parent::__construct($context);
    }

    /**
     * Render the page
     *
     * @return Page
     */
    public function execute(): Page
    {
        $page = $this->pageFactory->create();
        if (!$page instanceof Page) {
            throw new \LogicException('The admin area renders admin pages.');
        }
        $page->setActiveMenu(self::MENU_ITEM);

        return $page;
    }
}
