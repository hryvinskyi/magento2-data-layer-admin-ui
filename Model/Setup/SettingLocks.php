<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingLocksInterface;
use Magento\Config\Model\Config\Reader\Source\Deployed\SettingChecker;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;

/**
 * Asks the deployment configuration, scope by scope, which settings it fixes
 *
 * The check is the one the configuration page makes: a value in an environment variable or in the deployment
 * configuration files for the scope, or for the default scope, fixes the setting at that scope. The value reported is
 * the one the store reads at the scope.
 */
class SettingLocks implements SettingLocksInterface
{
    private const SCOPE_TYPES = [
        'default' => ScopeConfigInterface::SCOPE_TYPE_DEFAULT,
        'website' => ScopeInterface::SCOPE_WEBSITES,
        'store' => ScopeInterface::SCOPE_STORES,
    ];

    /**
     * @param SettingChecker $settingChecker
     * @param ScopeConfigInterface $scopeConfig
     */
    public function __construct(
        private readonly SettingChecker $settingChecker,
        private readonly ScopeConfigInterface $scopeConfig
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(array $paths, array $scopes): array
    {
        $message = (string) __('This setting is fixed in the deployment configuration and cannot be changed here.');
        $locks = [];
        foreach ($paths as $path) {
            foreach ($scopes as $scope) {
                $scopeType = self::SCOPE_TYPES[$scope['type']];
                $scopeCode = $scope['type'] === 'default' ? null : $scope['code'];
                if (!$this->settingChecker->isReadOnly($path, $scopeType, $scopeCode)) {
                    continue;
                }
                $value = $this->scopeConfig->getValue($path, $scopeType, $scopeCode);
                $locks[$path][$scope['id']] = [
                    'message' => $message,
                    'value' => is_scalar($value) ? (string) $value : null,
                ];
            }
        }

        return $locks;
    }
}
