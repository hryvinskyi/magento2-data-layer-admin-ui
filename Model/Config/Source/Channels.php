<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Source;

use Hryvinskyi\DataLayerApi\Api\Data\EventChannel;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Phrase;

/**
 * Where an event can be sent: the browser, the server, or both
 */
class Channels implements OptionSourceInterface
{
    /**
     * @inheritDoc
     *
     * @return list<array{value: string, label: Phrase}>
     */
    public function toOptionArray(): array
    {
        return array_map(
            static fn (EventChannel $channel): array => [
                'value' => $channel->value,
                'label' => match ($channel) {
                    EventChannel::Browser => __('Browser'),
                    EventChannel::Server => __('Server'),
                    EventChannel::Both => __('Both'),
                },
            ],
            EventChannel::cases()
        );
    }
}
