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
 * Saves a Google Ads conversion id: empty, or `AW-` followed by digits, stored in capitals
 */
class AdsConversionId extends Value
{
    /**
     * Refuse a value that is not a conversion id
     *
     * @return $this
     * @throws LocalizedException When the value is neither empty nor a conversion id
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $conversionId = is_scalar($value) ? strtoupper(trim((string) $value)) : '';
        if ($conversionId !== '' && preg_match(ConfigInterface::ADS_CONVERSION_ID_PATTERN, $conversionId) !== 1) {
            throw new LocalizedException(
                __('Use the format AW- followed by digits, for example AW-123456789.')
            );
        }
        $this->setValue($conversionId);

        return parent::beforeSave();
    }
}
