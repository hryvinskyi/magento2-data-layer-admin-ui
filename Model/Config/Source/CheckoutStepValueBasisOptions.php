<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Source;

use Hryvinskyi\DataLayer\Model\Config\CheckoutStepValueBasis;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Phrase;

/**
 * The amounts a checkout step's value can be
 */
class CheckoutStepValueBasisOptions implements OptionSourceInterface
{
    /**
     * @inheritDoc
     *
     * @return list<array{value: string, label: Phrase}>
     */
    public function toOptionArray(): array
    {
        return array_map(
            static fn (CheckoutStepValueBasis $basis): array => [
                'value' => $basis->value,
                'label' => match ($basis) {
                    CheckoutStepValueBasis::Items => __('Items value'),
                    CheckoutStepValueBasis::GrandTotal => __('Cart grand total'),
                },
            ],
            CheckoutStepValueBasis::cases()
        );
    }
}
