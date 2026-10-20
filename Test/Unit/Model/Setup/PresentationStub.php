<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;

/**
 * Presents every path as a field labelled with the setting's key, reaching store views, with the options given for
 * its path
 *
 * @phpstan-import-type Option from SettingPresentationInterface
 */
class PresentationStub implements SettingPresentationInterface
{
    /**
     * @param array<string, list<string>> $choices The option values of each path
     */
    public function __construct(
        private readonly array $choices = []
    ) {
    }

    /**
     * @inheritDoc
     */
    public function present(string $key, string $path): array
    {
        return [
            'label' => $key,
            'options' => array_map(
                static fn (string $value): array => ['value' => $value, 'label' => 'Option ' . $value],
                $this->choices[$path] ?? []
            ),
            'reach' => 'store',
        ];
    }
}
