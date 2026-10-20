<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\BuiltInDefaultsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopedValuesReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingLocksInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoredSettingsInterface;

/**
 * Reads the scope tree, then the stored rows, the shipped values and the deployment configuration's locks of the paths
 */
class ScopedValuesReader implements ScopedValuesReaderInterface
{
    /**
     * @param ScopeTreeInterface $scopeTree
     * @param StoredSettingsInterface $storedSettings
     * @param BuiltInDefaultsInterface $builtInDefaults
     * @param SettingLocksInterface $settingLocks
     * @param ScopedValuesInterfaceFactory $scopedValuesFactory
     */
    public function __construct(
        private readonly ScopeTreeInterface $scopeTree,
        private readonly StoredSettingsInterface $storedSettings,
        private readonly BuiltInDefaultsInterface $builtInDefaults,
        private readonly SettingLocksInterface $settingLocks,
        private readonly ScopedValuesInterfaceFactory $scopedValuesFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function read(array $paths): ScopedValuesInterface
    {
        $scopes = $this->scopeTree->getScopes();

        return $this->scopedValuesFactory->create([
            'scopes' => $scopes,
            'stored' => $this->storedSettings->read($paths),
            'builtIn' => $this->builtInDefaults->read($paths),
            'locks' => $this->settingLocks->read($paths, $scopes),
        ]);
    }
}
