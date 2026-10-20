<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupSessionInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupUrlsInterface;
use Magento\Framework\Data\Form\FormKey;

/**
 * Reads the session's form key and builds the addresses the way the page configuration builds them, over the scope
 * tree
 */
class SetupSession implements SetupSessionInterface
{
    /**
     * @param SetupUrlsInterface $urls
     * @param ScopeTreeInterface $scopeTree
     * @param FormKey $formKey
     */
    public function __construct(
        private readonly SetupUrlsInterface $urls,
        private readonly ScopeTreeInterface $scopeTree,
        private readonly FormKey $formKey
    ) {
    }

    /**
     * @inheritDoc
     */
    public function describe(): array
    {
        return [
            'formKey' => $this->formKey->getFormKey(),
            'endpoints' => $this->urls->getRequestEndpoints(),
            'links' => $this->urls->getLinks($this->scopeTree->getScopes()),
        ];
    }
}
