<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingLocksInterface;

/**
 * A snapshot of stored, shipped and fixed values over the scope tree, with the rules that read it
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @phpstan-import-type Lock from SettingLocksInterface
 */
class ScopedValues implements ScopedValuesInterface
{
    /**
     * How deep each scope type sits: a setting reaches a scope whose type is no deeper than its reach
     */
    private const DEPTH = ['default' => 0, 'website' => 1, 'store' => 2];

    /**
     * @var array<string, ScopeType>
     */
    private readonly array $types;

    /**
     * @var array<string, string|null>
     */
    private readonly array $parents;

    /**
     * @param list<Scope> $scopes The scope tree
     * @param array<string,array<string,string|null>> $stored Stored raw values keyed by path, then scope id
     * @param array<string,string|null> $builtIn Shipped raw values keyed by path
     * @param array<string,array<string,Lock>> $locks Fixed values keyed by path, then scope id
     */
    public function __construct(
        private readonly array $scopes,
        private readonly array $stored,
        private readonly array $builtIn,
        private readonly array $locks
    ) {
        $types = [];
        $parents = [];
        foreach ($scopes as $scope) {
            $types[$scope['id']] = $scope['type'];
            $parents[$scope['id']] = $scope['parent'];
        }
        $this->types = $types;
        $this->parents = $parents;
    }

    /**
     * @inheritDoc
     */
    public function getScopes(): array
    {
        return $this->scopes;
    }

    /**
     * @inheritDoc
     */
    public function getType(string $scopeId): ?string
    {
        return $this->types[$scopeId] ?? null;
    }

    /**
     * @inheritDoc
     */
    public function reaches(string $scopeId, string $reach): bool
    {
        $type = $this->types[$scopeId] ?? null;

        return $type !== null && self::DEPTH[$type] <= self::DEPTH[$reach];
    }

    /**
     * @inheritDoc
     */
    public function getOwn(string $path, string $reach): array
    {
        $values = [];
        foreach ($this->stored[$path] ?? [] as $scopeId => $raw) {
            if ($this->reaches($scopeId, $reach)) {
                $values[$scopeId] = $raw;
            }
        }
        foreach ($this->locks[$path] ?? [] as $scopeId => $lock) {
            if ($this->reaches($scopeId, $reach)) {
                $values[$scopeId] = $lock['value'];
            }
        }

        return $values;
    }

    /**
     * @inheritDoc
     */
    public function getEffective(string $path, string $reach, string $scopeId): ?string
    {
        $own = $this->getOwn($path, $reach);
        for ($scope = $scopeId; $scope !== null; $scope = $this->parents[$scope] ?? null) {
            if (array_key_exists($scope, $own)) {
                return $own[$scope];
            }
        }

        return $this->getBuiltIn($path);
    }

    /**
     * @inheritDoc
     */
    public function getBuiltIn(string $path): ?string
    {
        return $this->builtIn[$path] ?? null;
    }

    /**
     * @inheritDoc
     */
    public function getLocks(array $reaches): array
    {
        $messages = [];
        foreach (array_keys($this->types) as $scopeId) {
            foreach ($reaches as $path => $reach) {
                $lock = $this->locks[$path][$scopeId] ?? null;
                if ($lock !== null && $this->reaches($scopeId, $reach)) {
                    $messages[$scopeId] = $lock['message'];
                    break;
                }
            }
        }

        return $messages;
    }
}
