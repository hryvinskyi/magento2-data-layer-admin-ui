<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;

/**
 * How one kind of setting travels between the stored config value and the setup wizard
 *
 * A kind turns a stored raw value into the value the browser shows, and a value the browser sends into the raw value
 * to store or to draft, refusing a value the setting does not take: every save, preview and test draft goes through
 * it, so the server never relies on the browser's own checks. A secret's stored value never leaves the server: the
 * browser only learns whether one is set.
 *
 * @api
 */
interface SettingKindInterface
{
    /**
     * Get the code descriptors name the kind by
     *
     * @return string
     */
    public function getCode(): string;

    /**
     * Turn a stored raw value into the value the browser shows
     *
     * @param string|null $stored The raw stored value; null when nothing is stored
     * @return bool|string|array{set: bool}
     */
    public function present(?string $stored): bool|string|array;

    /**
     * Turn a value the browser sent into the raw value to store or to draft
     *
     * @param SettingDescriptorInterface $setting The setting the value is for
     * @param mixed $wire The value as the browser sent it
     * @return string
     * @throws InvalidSetupRequestException When the value has the wrong type or is not a value the setting takes
     */
    public function toStored(SettingDescriptorInterface $setting, mixed $wire): string;

    /**
     * Whether a value of this kind can change what an event holds, so an event preview drafts it
     *
     * @return bool
     */
    public function isPreviewable(): bool;
}
