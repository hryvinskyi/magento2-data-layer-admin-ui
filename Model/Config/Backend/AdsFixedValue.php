<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Backend;

use Magento\Framework\App\Config\Value;
use Magento\Framework\Exception\LocalizedException;

/**
 * Saves a fixed Google Ads conversion value: empty, or a number of zero or more
 */
class AdsFixedValue extends Value
{
    /**
     * Refuse a value that is not an amount
     *
     * @return $this
     * @throws LocalizedException When the value is neither empty nor a number of zero or more
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $amount = is_scalar($value) ? trim((string) $value) : '';
        if ($amount !== '' && (!is_numeric($amount) || !is_finite((float) $amount) || (float) $amount < 0.0)) {
            throw new LocalizedException(
                __('Enter an amount of zero or more, for example 25.00.')
            );
        }
        $this->setValue($amount);

        return parent::beforeSave();
    }
}
