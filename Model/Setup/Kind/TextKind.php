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
 * A setting whose value is free text
 *
 * Shown as the stored text, empty when nothing is stored; stored trimmed. A case-insensitive setting is stored in
 * capitals, as its own save does, so a value drafted for a preview or a test reads the same as a saved one. A setting
 * registered with a format pattern takes only text that matches it, checked with the same PHP pattern the setting's
 * own save uses after the value is trimmed and, when case-insensitive, put in capitals; empty text means "none" and is
 * always taken.
 */
class TextKind implements SettingKindInterface
{
    /**
     * @inheritDoc
     */
    public function getCode(): string
    {
        return 'text';
    }

    /**
     * @inheritDoc
     */
    public function present(?string $stored): string
    {
        return $stored ?? '';
    }

    /**
     * @inheritDoc
     */
    public function toStored(SettingDescriptorInterface $setting, mixed $wire): string
    {
        if (!is_string($wire)) {
            throw new InvalidSetupRequestException(__('The setting "%1" takes text.', $setting->getKey()));
        }
        $value = trim($wire);
        if ($setting->isCaseInsensitive()) {
            $value = strtoupper($value);
        }
        $pattern = $setting->getPattern();
        if ($value !== '' && $pattern !== null && preg_match($pattern, $value) !== 1) {
            throw new InvalidSetupRequestException(
                __('"%1" is not in the format the setting "%2" takes.', $value, $setting->getKey())
            );
        }

        return $value;
    }

    /**
     * @inheritDoc
     */
    public function isPreviewable(): bool
    {
        return true;
    }
}
