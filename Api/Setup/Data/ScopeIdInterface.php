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
 * A scope as the setup wizard names it: `default`, `website:<website id>` or `store:<store view id>`
 *
 * Well formed by construction; whether the website or store view exists is for the scope tree to say.
 *
 * @phpstan-import-type ScopeType from ScopeTreeInterface
 * @api
 */
interface ScopeIdInterface
{
    /**
     * Get the type of the scope
     *
     * @return ScopeType
     */
    public function getType(): string;

    /**
     * Get the id of the website or store view
     *
     * @return int The website or store view id; 0 for the default scope
     */
    public function getId(): int;

    /**
     * Get the scope id as the wizard writes it
     *
     * @return string
     */
    public function toString(): string;
}
