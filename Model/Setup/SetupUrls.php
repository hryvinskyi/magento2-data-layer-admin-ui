<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Form\SettingsGroupLinkInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupUrlsInterface;
use Magento\Backend\Model\UrlInterface;

/**
 * Builds every address with the admin's URL builder, so each carries the secret key when the admin uses one, except
 * the session's, which is built without it
 *
 * The configuration section opens at a website with its `website` parameter and at a store view with its `store`
 * parameter, as the configuration page's own scope switcher links it.
 */
class SetupUrls implements SetupUrlsInterface
{
    private const SAVE_ROUTE = 'hryvinskyi_datalayer/setup/save';
    private const PREVIEW_ROUTE = 'hryvinskyi_datalayer/setup/preview';
    private const PRODUCTS_ROUTE = 'hryvinskyi_datalayer/setup/products';
    private const SESSION_ROUTE = 'hryvinskyi_datalayer/setup/session';
    private const SECTION = 'hryvinskyi_datalayer';

    /**
     * @param UrlInterface $urlBuilder
     * @param ScopeIdInterfaceFactory $scopeIdFactory
     */
    public function __construct(
        private readonly UrlInterface $urlBuilder,
        private readonly ScopeIdInterfaceFactory $scopeIdFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getEndpoints(array $scopes): array
    {
        return $this->getRequestEndpoints() + $this->getLinks($scopes);
    }

    /**
     * @inheritDoc
     */
    public function getRequestEndpoints(): array
    {
        return [
            'save' => $this->urlBuilder->getUrl(self::SAVE_ROUTE),
            'preview' => $this->urlBuilder->getUrl(self::PREVIEW_ROUTE),
            'products' => $this->urlBuilder->getUrl(self::PRODUCTS_ROUTE),
            'session' => $this->urlBuilder->getUrl(self::SESSION_ROUTE, ['_nosecret' => true]),
        ];
    }

    /**
     * @inheritDoc
     */
    public function getLinks(array $scopes): array
    {
        $settings = [];
        foreach ($scopes as $scope) {
            $settings[$scope['id']] = $this->settingsUrl($scope['id']);
        }

        return ['advanced' => $settings, 'close' => $settings];
    }

    /**
     * Build the address of the configuration section at a scope
     *
     * @param string $scopeId
     * @return string
     * @throws \InvalidArgumentException When the text is not a scope id
     */
    private function settingsUrl(string $scopeId): string
    {
        $scope = $this->scopeIdFactory->create(['value' => $scopeId]);
        $params = ['section' => self::SECTION];
        $scopeParam = match ($scope->getType()) {
            'default' => null,
            'website' => 'website',
            'store' => 'store',
        };
        if ($scopeParam !== null) {
            $params[$scopeParam] = $scope->getId();
        }

        return $this->urlBuilder->getUrl(SettingsGroupLinkInterface::ROUTE, $params);
    }
}
