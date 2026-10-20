<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingFieldsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingFieldsPoolInterface;

/**
 * The ways settings are saved registered in `di.xml` under their setting key, and the one every registered wizard
 * setting without its own entry is saved by
 *
 * An item that is not a way of saving fails when the pool is built.
 */
class SettingFieldsPool implements SettingFieldsPoolInterface
{
    /**
     * @var array<string, SettingFieldsInterface>
     */
    private readonly array $fields;

    /**
     * @param SettingFieldsInterface $registered Saves every registered wizard setting without its own entry
     * @param array<mixed> $fields Ways of saving keyed by the setting key they save
     * @throws \InvalidArgumentException When an item is not a way of saving a setting
     */
    public function __construct(
        private readonly SettingFieldsInterface $registered,
        array $fields = []
    ) {
        $pool = [];
        foreach ($fields as $key => $item) {
            if (!$item instanceof SettingFieldsInterface) {
                throw new \InvalidArgumentException(sprintf(
                    'The way of saving the setting "%s" must implement %s.',
                    (string) $key,
                    SettingFieldsInterface::class
                ));
            }
            $pool[(string) $key] = $item;
        }
        $this->fields = $pool;
    }

    /**
     * @inheritDoc
     */
    public function get(string $key): SettingFieldsInterface
    {
        return $this->fields[$key] ?? $this->registered;
    }
}
