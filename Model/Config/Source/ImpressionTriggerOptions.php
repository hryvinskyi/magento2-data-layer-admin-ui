<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Source;

use Hryvinskyi\DataLayer\Model\Config\ImpressionTrigger;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Phrase;

/**
 * When a product list can report its impression
 */
class ImpressionTriggerOptions implements OptionSourceInterface
{
    /**
     * @inheritDoc
     *
     * @return list<array{value: string, label: Phrase}>
     */
    public function toOptionArray(): array
    {
        return array_map(
            static fn (ImpressionTrigger $trigger): array => [
                'value' => $trigger->value,
                'label' => match ($trigger) {
                    ImpressionTrigger::Load => __('When the page loads'),
                    ImpressionTrigger::Visible => __('When the list scrolls into view'),
                },
            ],
            ImpressionTrigger::cases()
        );
    }
}
