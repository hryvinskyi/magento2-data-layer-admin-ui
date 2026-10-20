<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\ScopeId;

/**
 * Builds real scope ids from the named argument the generated factory would pass on
 */
class ScopeIdFactoryStub extends ScopeIdInterfaceFactory
{
    /**
     * Build without an object manager
     */
    public function __construct()
    {
    }

    /**
     * Build a scope id from its text
     *
     * @param array{value?: string} $data
     * @return ScopeIdInterface
     */
    public function create(array $data = [])
    {
        return new ScopeId($data['value'] ?? '');
    }
}
