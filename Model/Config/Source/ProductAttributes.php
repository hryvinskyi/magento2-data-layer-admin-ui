<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Config\Source;

use Magento\Catalog\Api\ProductAttributeRepositoryInterface;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\Data\OptionSourceInterface;

/**
 * Product attributes whose given field takes one of the given values, sorted by label
 *
 * Configured per setting: the field and its values pick the attributes (for example `backend_type` in
 * `varchar`, `text`, `static`), and the leading options (each a `value` and a `label`) come first, in the order
 * given. A leading option's label is kept in the source language it is given in and translated each time the options
 * are read, so the shared list answers each request in its own locale.
 */
class ProductAttributes implements OptionSourceInterface
{
    /**
     * @param ProductAttributeRepositoryInterface $attributes
     * @param SearchCriteriaBuilder $criteria
     * @param string $field The attribute field to filter on
     * @param array<mixed> $values The values of that field to list
     * @param array<mixed> $leadingOptions Options listed first, each an array with a `value` and a `label`
     */
    public function __construct(
        private readonly ProductAttributeRepositoryInterface $attributes,
        private readonly SearchCriteriaBuilder $criteria,
        private readonly string $field,
        private readonly array $values,
        private readonly array $leadingOptions = []
    ) {
    }

    /**
     * @inheritDoc
     *
     * @return list<array{value: string, label: string}>
     * @phpstan-impure The answer follows the locale active when it is read
     */
    public function toOptionArray(): array
    {
        $options = [];
        foreach ($this->leadingOptions as $option) {
            $value = is_array($option) ? $option['value'] ?? '' : null;
            $label = is_array($option) ? $option['label'] ?? null : null;
            if (is_scalar($value) && (is_scalar($label) || $label instanceof \Stringable)) {
                $options[] = ['value' => (string) $value, 'label' => (string) __((string) $label)];
            }
        }

        $criteria = $this->criteria->addFilter($this->field, array_values($this->values), 'in')->create();
        $attributes = [];
        foreach ($this->attributes->getList($criteria)->getItems() as $attribute) {
            $code = (string) $attribute->getAttributeCode();
            $label = trim((string) $attribute->getDefaultFrontendLabel());
            $attributes[] = ['value' => $code, 'label' => $label !== '' ? $label . ' (' . $code . ')' : $code];
        }
        usort(
            $attributes,
            static fn (array $left, array $right): int => strcasecmp($left['label'], $right['label'])
        );

        return array_merge($options, $attributes);
    }
}
