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
use Magento\Framework\Phrase;

/**
 * A setting whose value is a whole number, travelling as text
 *
 * Shown as the stored text, empty when nothing is stored. A value is taken only when it is a whole number within the
 * setting's registered minimum and maximum, either of which may be left out, read the way the setting's own save
 * reads it (PHP's whole-number validation, so `+7` is 7 and `07` or `7.0` is refused); it is stored as that number.
 */
class NumberKind implements SettingKindInterface
{
    /**
     * @inheritDoc
     */
    public function getCode(): string
    {
        return 'number';
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
        $min = $setting->getMin();
        $max = $setting->getMax();
        $range = [];
        if ($min !== null) {
            $range['min_range'] = $min;
        }
        if ($max !== null) {
            $range['max_range'] = $max;
        }
        $number = filter_var(is_string($wire) ? trim($wire) : null, FILTER_VALIDATE_INT, ['options' => $range]);
        if (!is_int($number)) {
            throw new InvalidSetupRequestException($this->refusal($setting->getKey(), $min, $max));
        }

        return (string) $number;
    }

    /**
     * @inheritDoc
     */
    public function isPreviewable(): bool
    {
        return true;
    }

    /**
     * Say which numbers the setting takes
     *
     * @param string $key
     * @param int|null $min
     * @param int|null $max
     * @return Phrase
     */
    private function refusal(string $key, ?int $min, ?int $max): Phrase
    {
        if ($min !== null && $max !== null) {
            return __('The setting "%1" takes a whole number from %2 to %3.', $key, $min, $max);
        }
        if ($min !== null) {
            return __('The setting "%1" takes a whole number of at least %2.', $key, $min);
        }
        if ($max !== null) {
            return __('The setting "%1" takes a whole number of at most %2.', $key, $max);
        }

        return __('The setting "%1" takes a whole number.', $key);
    }
}
