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
 * Saves the host Google Tag Manager is loaded from: empty, or a host name alone, without scheme, port or path
 */
class ScriptHost extends Value
{
    /**
     * Refuse a value that is not a host name; store it in lower case
     *
     * @return $this
     * @throws LocalizedException When the value is neither empty nor a host name
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $host = is_scalar($value) ? strtolower(trim((string) $value)) : '';
        if ($host !== '' && (!str_contains($host, '.')
            || filter_var($host, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) === false)
        ) {
            throw new LocalizedException(
                __('Enter the host name only, for example gtm.example.com. Remove “https://” and the path.')
            );
        }
        $this->setValue($host);

        return parent::beforeSave();
    }
}
