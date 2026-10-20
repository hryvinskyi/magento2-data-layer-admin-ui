<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Backend;

use Hryvinskyi\DataLayer\Model\Data\Ga4Name;
use Hryvinskyi\DataLayerApi\Api\Data\EventChannel;
use Magento\Config\Model\Config\Backend\Serialized\ArraySerialized;
use Magento\Framework\Exception\LocalizedException;

/**
 * Saves the event routing rows: each an event name and an existing channel, stored as a JSON list
 *
 * The form's placeholder row is dropped and so is a row left entirely blank. A row naming something that is not an
 * event, or a channel that does not exist, is refused rather than stored, since routing would ignore it silently.
 */
class ChannelRoutingRows extends ArraySerialized
{
    /**
     * Refuse rows routing would ignore; store the rest as a list
     *
     * @return $this
     * @throws LocalizedException When a row's event is not an event name or its channel does not exist
     */
    public function beforeSave()
    {
        $value = $this->getValue();
        $rows = [];
        foreach (is_array($value) ? $value : [] as $key => $row) {
            if ($key === '__empty' || !is_array($row)) {
                continue;
            }
            $event = is_scalar($row['event'] ?? null) ? trim((string) $row['event']) : '';
            $channel = is_scalar($row['channel'] ?? null) ? trim((string) $row['channel']) : '';
            if ($event === '' && $channel === '') {
                continue;
            }
            if (preg_match(Ga4Name::PATTERN, $event) !== 1) {
                throw new LocalizedException(__('"%1" is not an event name, so it cannot be routed.', $event));
            }
            if (EventChannel::tryFrom($channel) === null) {
                throw new LocalizedException(
                    __(
                        '"%1" is not a channel. The event %2 can go to the browser, the server or both.',
                        $channel,
                        $event
                    )
                );
            }
            $rows[] = ['event' => $event, 'channel' => $channel];
        }
        $this->setValue($rows);

        return parent::beforeSave();
    }
}
