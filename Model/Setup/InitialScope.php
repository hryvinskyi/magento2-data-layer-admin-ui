<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\InitialScopeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;

/**
 * Turns each parameter into the scope id it would name and opens at the narrowest one the scope tree has
 */
class InitialScope implements InitialScopeInterface
{
    private const ID_PATTERN = '/^[1-9][0-9]{0,9}$/D';

    /**
     * @inheritDoc
     */
    public function resolve(mixed $website, mixed $store, array $scopes): string
    {
        $present = array_column($scopes, 'id');
        $candidates = [
            $this->scopeId(ScopeTreeInterface::STORE_PREFIX, $store),
            $this->scopeId(ScopeTreeInterface::WEBSITE_PREFIX, $website),
        ];
        foreach ($candidates as $candidate) {
            if ($candidate !== null && in_array($candidate, $present, true)) {
                return $candidate;
            }
        }

        return ScopeTreeInterface::DEFAULT_SCOPE;
    }

    /**
     * Build the scope id a parameter names
     *
     * @param string $prefix
     * @param mixed $value
     * @return string|null Null when the value is not a positive whole number
     */
    private function scopeId(string $prefix, mixed $value): ?string
    {
        $text = is_int($value) ? (string) $value : $value;

        return is_string($text) && preg_match(self::ID_PATTERN, $text) === 1 ? $prefix . $text : null;
    }
}
