<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;

/**
 * A scope id read from its text, refused unless it is `default`, or `website:` or `store:` followed by a positive
 * whole number without leading zeros
 *
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 */
class ScopeId implements ScopeIdInterface
{
    private const PATTERN = '/^(website|store):([1-9][0-9]{0,9})$/D';

    /**
     * @var ScopeType
     */
    private readonly string $type;

    /**
     * @var int
     */
    private readonly int $id;

    /**
     * @param string $value The scope id as the wizard writes it
     * @throws \InvalidArgumentException When the text is not a scope id
     */
    public function __construct(string $value)
    {
        if ($value === ScopeTreeInterface::DEFAULT_SCOPE) {
            $this->type = 'default';
            $this->id = 0;

            return;
        }
        if (preg_match(self::PATTERN, $value, $parts) !== 1) {
            throw new \InvalidArgumentException((string) __('"%1" is not a scope.', $value));
        }
        $this->type = $parts[1] === 'website' ? 'website' : 'store';
        $this->id = (int) $parts[2];
    }

    /**
     * @inheritDoc
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * @inheritDoc
     */
    public function getId(): int
    {
        return $this->id;
    }

    /**
     * @inheritDoc
     */
    public function toString(): string
    {
        return match ($this->type) {
            'default' => ScopeTreeInterface::DEFAULT_SCOPE,
            'website' => ScopeTreeInterface::WEBSITE_PREFIX . $this->id,
            'store' => ScopeTreeInterface::STORE_PREFIX . $this->id,
        };
    }
}
