<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindsInterface;

/**
 * The setting kinds registered in `di.xml`, each under its own code
 *
 * An item that is not a kind, or is registered under a key other than its code, fails when the pool is built.
 */
class SettingKinds implements SettingKindsInterface
{
    /**
     * @var array<string, SettingKindInterface>
     */
    private readonly array $kinds;

    /**
     * @param array<mixed> $kinds Each kind, keyed by its code
     * @throws \InvalidArgumentException When an item is not a kind or is not keyed by its code
     */
    public function __construct(array $kinds = [])
    {
        $registered = [];
        foreach ($kinds as $code => $kind) {
            if (!$kind instanceof SettingKindInterface) {
                throw new \InvalidArgumentException(sprintf(
                    'The setting kind "%s" must implement %s.',
                    (string) $code,
                    SettingKindInterface::class
                ));
            }
            if ($kind->getCode() !== (string) $code) {
                throw new \InvalidArgumentException(sprintf(
                    'The setting kind "%s" is registered under "%s"; register it under its code.',
                    $kind->getCode(),
                    (string) $code
                ));
            }
            $registered[$kind->getCode()] = $kind;
        }
        $this->kinds = $registered;
    }

    /**
     * @inheritDoc
     */
    public function get(string $code): SettingKindInterface
    {
        return $this->kinds[$code] ?? throw new \InvalidArgumentException(
            sprintf('No setting kind is registered under "%s".', $code)
        );
    }
}
