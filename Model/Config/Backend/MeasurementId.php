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
 * Saves a Google Analytics 4 measurement id: empty, or `G-` followed by capital letters and digits, stored in capitals
 */
class MeasurementId extends Value
{
    /**
     * Refuse a value that is not a measurement id
     *
     * @return $this
     * @throws LocalizedException When the value is neither empty nor a measurement id
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $measurementId = is_scalar($value) ? strtoupper(trim((string) $value)) : '';
        if ($measurementId !== '' && preg_match(ConfigInterface::MEASUREMENT_ID_PATTERN, $measurementId) !== 1) {
            throw new LocalizedException(
                __('Use the format G- followed by letters and digits.')
            );
        }
        $this->setValue($measurementId);

        return parent::beforeSave();
    }
}
