<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingLocksInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\ScopedValues;

/**
 * Builds real scoped values from the named arguments the generated factory would pass on
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 * @phpstan-import-type Lock from SettingLocksInterface
 */
class ScopedValuesFactoryStub extends ScopedValuesInterfaceFactory
{
    /**
     * Build without an object manager
     */
    public function __construct()
    {
    }

    /**
     * Build scoped values from named arguments
     *
     * @param array{
     *     scopes?: list<Scope>,
     *     stored?: array<string, array<string, string|null>>,
     *     builtIn?: array<string, string|null>,
     *     locks?: array<string, array<string, Lock>>
     * } $data
     * @return ScopedValuesInterface
     */
    public function create(array $data = [])
    {
        return new ScopedValues(
            $data['scopes'] ?? [],
            $data['stored'] ?? [],
            $data['builtIn'] ?? [],
            $data['locks'] ?? []
        );
    }
}
