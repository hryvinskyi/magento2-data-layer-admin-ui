<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Backend;

use Hryvinskyi\DataLayer\Model\Data\Ga4Name;
use Magento\Framework\App\Config\Value;
use Magento\Framework\Exception\LocalizedException;

/**
 * Saves the events a scope does not send: a comma list of GA4 event names, trimmed, each named once
 *
 * The list may be posted as one comma list or as a list of names, and may be empty. A name that is not a GA4 event
 * name is refused rather than stored, since no event could ever match it.
 */
class DisabledEvents extends Value
{
    /**
     * Refuse a list that names something other than events; store it as one comma list
     *
     * @return $this
     * @throws LocalizedException When an entry is not a GA4 event name
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $entries = is_array($value) ? $value : explode(',', is_scalar($value) ? (string) $value : '');
        $names = [];
        foreach ($entries as $entry) {
            $name = is_scalar($entry) ? trim((string) $entry) : '';
            if ($name === '' || in_array($name, $names, true)) {
                continue;
            }
            if (preg_match(Ga4Name::PATTERN, $name) !== 1) {
                throw new LocalizedException(__('"%1" is not an event name, so it cannot be switched off.', $name));
            }
            $names[] = $name;
        }
        $this->setValue(implode(',', $names));

        return parent::beforeSave();
    }
}
