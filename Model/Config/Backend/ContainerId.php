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
 * Saves a Google Tag Manager container id: empty, or `GTM-` followed by capital letters and digits
 */
class ContainerId extends Value
{
    /**
     * Refuse a value that is not a container id
     *
     * @return $this
     * @throws LocalizedException When the value is neither empty nor a container id
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $containerId = is_scalar($value) ? trim((string) $value) : '';
        if ($containerId !== '' && preg_match(ConfigInterface::CONTAINER_ID_PATTERN, $containerId) !== 1) {
            throw new LocalizedException(
                __('Use the format GTM- followed by letters and digits, for example GTM-XXXXXXX. No spaces.')
            );
        }
        $this->setValue($containerId);

        return parent::beforeSave();
    }
}
