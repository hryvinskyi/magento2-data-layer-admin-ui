<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * The scopes a setting can be set at, as the setup wizard names them
 *
 * A scope id is `default`, `website:<website id>` or `store:<store view id>`. The default scope comes first, then each
 * website followed by its store views, websites and store views in their sort order; the admin store is not a scope.
 *
 * @phpstan-type ScopeType 'default'|'website'|'store'
 * @phpstan-type Scope array{
 *     id: string,
 *     type: ScopeType,
 *     name: string,
 *     code: string,
 *     domain?: string,
 *     parent: string|null
 * }
 * @api
 */
interface ScopeTreeInterface
{
    /**
     * The id of the default scope
     */
    public const DEFAULT_SCOPE = 'default';

    /**
     * What a website's scope id starts with; the website id follows
     */
    public const WEBSITE_PREFIX = 'website:';

    /**
     * What a store view's scope id starts with; the store view id follows
     */
    public const STORE_PREFIX = 'store:';

    /**
     * Get every scope
     *
     * A website names the host of its default store view's base URL as its domain, when it has one; a store view's
     * parent is its website, a website's parent the default scope.
     *
     * @return list<Scope>
     */
    public function getScopes(): array;
}
