<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Source;

use Hryvinskyi\DataLayer\Model\Config\ValueBasis;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Phrase;

/**
 * The order amounts a purchase value can start from
 */
class ValueBasisOptions implements OptionSourceInterface
{
    /**
     * @inheritDoc
     *
     * @return list<array{value: string, label: Phrase}>
     */
    public function toOptionArray(): array
    {
        return array_map(
            static fn (ValueBasis $basis): array => [
                'value' => $basis->value,
                'label' => match ($basis) {
                    ValueBasis::GrandTotal => __('Grand total'),
                    ValueBasis::Subtotal => __('Subtotal'),
                },
            ],
            ValueBasis::cases()
        );
    }
}
