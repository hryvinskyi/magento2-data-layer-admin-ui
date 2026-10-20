<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Events;

use Hryvinskyi\DataLayerAdminUi\Api\Events\StoredEventSettingsInterface;
use Magento\Framework\Serialize\SerializerInterface;

/**
 * Reads the disabled-events list and the routing rows as the storefront's configuration reads them
 *
 * The routing value is unserialized with the same serializer the storefront's configuration uses; a value it cannot
 * read is no rows, as it is for the storefront.
 */
class StoredEventSettings implements StoredEventSettingsInterface
{
    /**
     * @param SerializerInterface $serializer
     */
    public function __construct(
        private readonly SerializerInterface $serializer
    ) {
    }

    /**
     * @inheritDoc
     */
    public function disabledNames(mixed $value): array
    {
        $names = is_array($value) ? $value : explode(',', is_scalar($value) ? (string) $value : '');
        $clean = [];
        foreach ($names as $name) {
            $name = is_scalar($name) ? trim((string) $name) : '';
            if ($name !== '' && !in_array($name, $clean, true)) {
                $clean[] = $name;
            }
        }

        return $clean;
    }

    /**
     * @inheritDoc
     */
    public function routingRows(mixed $value): array
    {
        $rows = [];
        foreach ($this->loaded($value) as $row) {
            if (is_array($row) && is_string($row['event'] ?? null) && is_string($row['channel'] ?? null)) {
                $rows[] = ['event' => $row['event'], 'channel' => $row['channel']];
            }
        }

        return $rows;
    }

    /**
     * Get the routing value as loaded rows
     *
     * @param mixed $value
     * @return array<mixed>
     */
    private function loaded(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || $value === '') {
            return [];
        }
        try {
            $rows = $this->serializer->unserialize($value);
        } catch (\InvalidArgumentException) {
            return [];
        }

        return is_array($rows) ? $rows : [];
    }
}
