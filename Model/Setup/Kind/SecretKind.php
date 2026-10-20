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
 * A secret setting: the browser learns only whether one is set, never its value, stored or decrypted
 *
 * A new secret is stored as sent, trimmed; an empty one is refused, and so is one made only of asterisks, which the
 * configuration page's encrypted field reads as "keep the current secret" and would silently not store. A secret only
 * lets the store reach a service; it never shows in an event, so an event preview does not draft one.
 */
class SecretKind implements SettingKindInterface
{
    private const OBSCURED_PATTERN = '/^\*+$/D';

    /**
     * @inheritDoc
     */
    public function getCode(): string
    {
        return 'secret';
    }

    /**
     * @inheritDoc
     *
     * @return array{set: bool}
     */
    public function present(?string $stored): array
    {
        return ['set' => $stored !== null && $stored !== ''];
    }

    /**
     * @inheritDoc
     */
    public function toStored(SettingDescriptorInterface $setting, mixed $wire): string
    {
        $secret = is_string($wire) ? trim($wire) : '';
        if ($secret === '') {
            throw new InvalidSetupRequestException(
                __('The setting "%1" takes a secret that is not empty.', $setting->getKey())
            );
        }
        if (preg_match(self::OBSCURED_PATTERN, $secret) === 1) {
            throw new InvalidSetupRequestException(
                __('The setting "%1" cannot be a secret made only of asterisks.', $setting->getKey())
            );
        }

        return $secret;
    }

    /**
     * @inheritDoc
     */
    public function isPreviewable(): bool
    {
        return false;
    }
}
