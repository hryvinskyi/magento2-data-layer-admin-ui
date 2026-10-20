<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindInterface;

/**
 * A yes/no setting: stored as `1` or `0`, shown as true or false
 *
 * Only a stored `1` is yes, as the storefront reads a flag; anything else, nothing stored included, is no.
 */
class FlagKind implements SettingKindInterface
{
    /**
     * @inheritDoc
     */
    public function getCode(): string
    {
        return 'flag';
    }

    /**
     * @inheritDoc
     */
    public function present(?string $stored): bool
    {
        return $stored === '1';
    }

    /**
     * @inheritDoc
     */
    public function toStored(SettingDescriptorInterface $setting, mixed $wire): string
    {
        if (!is_bool($wire)) {
            throw new InvalidSetupRequestException(__('The setting "%1" takes true or false.', $setting->getKey()));
        }

        return $wire ? '1' : '0';
    }

    /**
     * @inheritDoc
     */
    public function isPreviewable(): bool
    {
        return true;
    }
}
