<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Source;

use Hryvinskyi\DataLayer\Model\Config\AdsValueSource;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Phrase;

/**
 * Where a Google Ads conversion's value can come from
 */
class AdsValueSourceOptions implements OptionSourceInterface
{
    /**
     * @inheritDoc
     *
     * @return list<array{value: string, label: Phrase}>
     */
    public function toOptionArray(): array
    {
        return array_map(
            static fn (AdsValueSource $source): array => [
                'value' => $source->value,
                'label' => match ($source) {
                    AdsValueSource::Purchase => __('Purchase value'),
                    AdsValueSource::Fixed => __('Fixed value'),
                },
            ],
            AdsValueSource::cases()
        );
    }
}
