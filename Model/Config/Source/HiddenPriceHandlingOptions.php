<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Source;

use Hryvinskyi\DataLayer\Model\Config\HiddenPriceHandling;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Phrase;

/**
 * What can happen to an event whose product price is hidden from the viewer
 */
class HiddenPriceHandlingOptions implements OptionSourceInterface
{
    /**
     * @inheritDoc
     *
     * @return list<array{value: string, label: Phrase}>
     */
    public function toOptionArray(): array
    {
        return array_map(
            static fn (HiddenPriceHandling $handling): array => [
                'value' => $handling->value,
                'label' => match ($handling) {
                    HiddenPriceHandling::OmitPrice => __('Send the event without prices'),
                    HiddenPriceHandling::SkipEvent => __('Do not send ecommerce events'),
                },
            ],
            HiddenPriceHandling::cases()
        );
    }
}
