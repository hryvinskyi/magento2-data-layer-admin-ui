<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Backend;

use Hryvinskyi\DataLayer\Api\ConfigInterface;
use Magento\Framework\App\Config\Value;
use Magento\Framework\Exception\LocalizedException;

/**
 * Saves a Google Ads conversion label: empty, or letters, digits, `_` and `-`, the characters that can follow the id
 * in a conversion's `send_to`
 */
class AdsConversionLabel extends Value
{
    /**
     * Refuse a value that is not a conversion label
     *
     * @return $this
     * @throws LocalizedException When the value is neither empty nor a conversion label
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $label = is_scalar($value) ? trim((string) $value) : '';
        if ($label !== '' && preg_match(ConfigInterface::ADS_CONVERSION_LABEL_PATTERN, $label) !== 1) {
            throw new LocalizedException(
                __('Use letters, digits, underscores and hyphens only: the part after the slash in send_to.')
            );
        }
        $this->setValue($label);

        return parent::beforeSave();
    }
}
