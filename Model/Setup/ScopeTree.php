<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Laminas\Uri\HttpFactory;
use Magento\Framework\UrlInterface;
use Magento\Store\Api\Data\StoreInterface;
use Magento\Store\Api\Data\WebsiteInterface;
use Magento\Store\Model\ResourceModel\Store\CollectionFactory as StoreCollectionFactory;
use Magento\Store\Model\ResourceModel\Website\CollectionFactory as WebsiteCollectionFactory;
use Magento\Store\Model\Store;
use Magento\Store\Model\Website;

/**
 * Reads the scope tree from the websites and store views, each in its sort order, then by name
 *
 * Each base URL is parsed by a URI of its own, so no parsed state is shared between URLs or between requests.
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 */
class ScopeTree implements ScopeTreeInterface
{
    /**
     * @param WebsiteCollectionFactory $websiteCollectionFactory Lists websites without the admin website
     * @param StoreCollectionFactory $storeCollectionFactory Lists store views without the admin store
     * @param HttpFactory $uriFactory Creates the URI that reads the host of one base URL
     */
    public function __construct(
        private readonly WebsiteCollectionFactory $websiteCollectionFactory,
        private readonly StoreCollectionFactory $storeCollectionFactory,
        private readonly HttpFactory $uriFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getScopes(): array
    {
        $storesByWebsite = [];
        foreach ($this->storeCollectionFactory->create()->getItems() as $store) {
            if ($store instanceof StoreInterface) {
                $storesByWebsite[(int) $store->getWebsiteId()][] = $store;
            }
        }

        $scopes = [[
            'id' => self::DEFAULT_SCOPE,
            'type' => 'default',
            'name' => (string) __('Default Config'),
            'code' => '',
            'parent' => null,
        ]];
        foreach ($this->websiteCollectionFactory->create()->getItems() as $website) {
            if (!$website instanceof WebsiteInterface) {
                continue;
            }
            $websiteId = self::WEBSITE_PREFIX . (int) $website->getId();
            $scopes[] = $this->website($website, $websiteId);
            foreach ($storesByWebsite[(int) $website->getId()] ?? [] as $store) {
                $scopes[] = [
                    'id' => self::STORE_PREFIX . (int) $store->getId(),
                    'type' => 'store',
                    'name' => (string) $store->getName(),
                    'code' => (string) $store->getCode(),
                    'parent' => $websiteId,
                ];
            }
        }

        return $scopes;
    }

    /**
     * Describe a website's scope
     *
     * @param WebsiteInterface $website
     * @param string $scopeId
     * @return Scope
     */
    private function website(WebsiteInterface $website, string $scopeId): array
    {
        $scope = [
            'id' => $scopeId,
            'type' => 'website',
            'name' => (string) $website->getName(),
            'code' => (string) $website->getCode(),
            'parent' => self::DEFAULT_SCOPE,
        ];
        $domain = $this->domain($website);
        if ($domain !== null) {
            $scope['domain'] = $domain;
        }

        return $scope;
    }

    /**
     * Read the host of a website's default store view's base URL
     *
     * @param WebsiteInterface $website
     * @return string|null Null when the website has no default store view or its base URL names no host
     */
    private function domain(WebsiteInterface $website): ?string
    {
        $store = $website instanceof Website ? $website->getDefaultStore() : null;
        if (!$store instanceof Store) {
            return null;
        }
        $host = $this->uriFactory->create()->parse((string) $store->getBaseUrl(UrlInterface::URL_TYPE_WEB))->getHost();

        return is_string($host) && $host !== '' ? $host : null;
    }
}
