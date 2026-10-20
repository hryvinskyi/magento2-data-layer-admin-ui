<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\SettingDescriptor;

/**
 * Builds real setting descriptions from the named arguments the generated factory would pass on
 */
class SettingDescriptorFactoryStub extends SettingDescriptorInterfaceFactory
{
    /**
     * Build without an object manager
     */
    public function __construct()
    {
    }

    /**
     * Build a description from named arguments
     *
     * @param array<string, mixed> $data
     * @return SettingDescriptorInterface
     */
    public function create(array $data = [])
    {
        $text = static fn (string $name): string => is_string($data[$name] ?? null) ? $data[$name] : '';
        $pattern = $data['pattern'] ?? null;
        $min = $data['min'] ?? null;
        $max = $data['max'] ?? null;

        return new SettingDescriptor(
            $text('key'),
            $text('path'),
            $text('kind'),
            $text('step'),
            is_string($pattern) ? $pattern : null,
            ($data['caseInsensitive'] ?? false) === true,
            is_int($min) ? $min : null,
            is_int($max) ? $max : null
        );
    }
}
