<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;

/**
 * What is stored, shipped and fixed for some config paths across the scope tree, read the way the store reads it
 *
 * A setting reaches a scope whose type is no narrower than its reach: a website-only setting reaches the default
 * scope and websites, never a store view. A scope has a value of its own for a path when a row is stored there or the
 * deployment configuration fixes the path there; the store reads, at a scope, its own value, else the nearest
 * ancestor's (store view, then website, then default), else the shipped one. A scope outside the tree, such as a
 * deleted website or store view, has nothing.
 *
 * @phpstan-import-type Scope from ScopeTreeInterface
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @api
 */
interface ScopedValuesInterface
{
    /**
     * Get every scope of the tree
     *
     * @return list<Scope> In scope tree order
     */
    public function getScopes(): array;

    /**
     * Get the type of a scope of the tree
     *
     * @param string $scopeId
     * @return ScopeType|null Null when the scope is not in the tree
     */
    public function getType(string $scopeId): ?string;

    /**
     * Whether a scope is in the tree and within a reach
     *
     * @param string $scopeId
     * @param ScopeType $reach
     * @return bool
     */
    public function reaches(string $scopeId, string $reach): bool;

    /**
     * Get the raw values a path has of its own, scope by scope
     *
     * Stored values of scopes in the tree and within reach, with the value the store reads at every scope the
     * deployment configuration fixes in their place.
     *
     * @param string $path
     * @param ScopeType $reach
     * @return array<string, string|null> Keyed by scope id
     */
    public function getOwn(string $path, string $reach): array;

    /**
     * Get the raw value the store reads at a scope: its own, else the nearest ancestor's, else the shipped one
     *
     * @param string $path
     * @param ScopeType $reach
     * @param string $scopeId
     * @return string|null
     */
    public function getEffective(string $path, string $reach, string $scopeId): ?string;

    /**
     * Get the value modules ship for a path
     *
     * @param string $path
     * @return string|null Null when no module ships one
     */
    public function getBuiltIn(string $path): ?string;

    /**
     * Get why paths cannot be changed, scope by scope; a scope where any of the paths is fixed is fixed
     *
     * @param array<string,ScopeType> $reaches The reach of each path, keyed by path
     * @return array<string, string> The reason, keyed by scope id in scope tree order; scopes outside a path's reach
     *     are not reported for it
     */
    public function getLocks(array $reaches): array;
}
