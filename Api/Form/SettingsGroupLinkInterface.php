<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Form;

/**
 * Where a group of the admin's configuration page is: the page's route, its section and scope, and the anchor of the
 * group's heading
 *
 * @api
 */
interface SettingsGroupLinkInterface
{
    /**
     * The route of the configuration page
     */
    public const ROUTE = 'adminhtml/system_config/edit';

    /**
     * Get the route parameters that open a group of the configuration page
     *
     * @param string $groupPath The group's path: its section and group ids, for example `my_section/my_group`
     * @param int|null $websiteId The website whose scope opens; null for the default scope
     * @return array{section: string, website?: int, _fragment: string}
     * @throws \InvalidArgumentException When the path names no group of a section
     */
    public function routeParams(string $groupPath, ?int $websiteId): array;
}
